import assert from "assert";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import {
  getPathJobTriggersDirectory,
  getPathJobTriggersFile,
} from "~/paths.js";
import {
  awaitTruthy,
  createSha1Hash,
  createToken,
  presentablePath,
  shortenString,
  timeout,
} from "~/util.js";
import { Job } from "./job.js";
import { StatusLifecycle } from "./types.js";
import { CronTime } from "cron";
import {
  SendHandleRequest,
  SendHandleRequestHttp,
  SendHandleResponse,
} from "./runner-server.js";
import { connectAsync, IClientOptions, MqttClient } from "mqtt";

const configSchema = z.object({
  id: z.string(),
  jobName: z.string(),
  version: z.string(),

  context: z.union([
    z.object({
      type: z.literal("schedule"),
      cron: z.string(),
      timezone: z.string().optional(),
    }),
    z.object({
      type: z.literal("http"),
    }),
    z.object({
      type: z.literal("mqtt"),
      topics: z.array(z.string()),
      // allowPublish: z.boolean().default(true),
      connection: z.object({
        protocol: z.enum(["wss", "ws", "mqtt", "mqtts"]).optional(),
        protocolVariable: z.string().optional(),

        port: z.string().optional(),
        portVariable: z.string().optional(),

        host: z.string().optional(),
        hostVariable: z.string().optional(),

        username: z.string().optional(),
        usernameVariable: z.string().optional(),

        password: z.string().optional(),
        passwordVariable: z.string().optional(),

        clientId: z.string().optional(),
        clientIdVariable: z.string().optional(),
      }),
    }),
  ]),
});

type ConfigSchemaType = z.infer<typeof configSchema>;

type TriggerItem = ConfigSchemaType & {
  schedule?: {
    cronTime: CronTime;
    runAt: number;
  };
  mqtt?: {
    client: MqttClient;

    // Hash of connection details, used to determine if we need to recreate a connection
    // with new configuration. An example would be environment variables changing.
    configHash: string;
  };
};

export type TriggersHandleEvent = (
  jobName: string,
  request: SendHandleRequest
) => Promise<SendHandleResponse>;

export class Triggers {
  private triggers = new Map<string, TriggerItem>();

  private triggersIndexJobName: Record<string, string[]> = {};

  private job: Job;

  private status: StatusLifecycle = "neutral";

  private isLoopRunning = false;

  private onHandleEvent: null | TriggersHandleEvent = null;

  public registerHandleEvent(handler: TriggersHandleEvent) {
    this.onHandleEvent = handler;
  }

  constructor(job: Job) {
    this.job = job;
  }

  public async start() {
    if (
      this.status === "starting" ||
      this.status === "started" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Triggers/start] Cannot start with status of ${this.status}`
      );
    }

    this.status = "starting";

    const jobs = this.job.getJobs();

    for (const job of jobs) {
      const configs = await Triggers.readConfigFiles(job.name);

      for (const config of configs) {
        this.addTrigger(config);
      }
    }

    this.loop();

    this.status = "started";
  }

  public async stop() {
    if (
      this.status === "neutral" ||
      this.status === "starting" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Triggers/stop] Cannot stop with status of ${this.status}`
      );
    }

    console.log("[Triggers/stop] stopping triggers");
    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    for (const [id, trigger] of this.triggers) {
      assert(!trigger.mqtt);

      this.removeTrigger(id);
    }

    console.log("[Triggers/stop] stopped triggers");
    this.status = "neutral";
  }

  public async runHttpTrigger(
    jobName: string,
    request: SendHandleRequestHttp
  ): Promise<SendHandleResponse> {
    const job = this.job.getJob(jobName);
    const triggers = this.getTriggersByJobName(jobName);

    if (!job || triggers.length <= 0) {
      return {
        success: false,
        duration: 0,
        error: "Jobber: Generic failure",
      };
    }

    const canRun = triggers.some(
      (index) => index.context.type === "http" && index.version === job.version
    );

    if (!canRun) {
      return {
        success: false,
        duration: 0,
        error: "Jobber: Generic failure",
      };
    }

    assert(this.onHandleEvent);

    return await this.onHandleEvent(jobName, request);
  }

  public getTrigger(triggerId: string): ConfigSchemaType {
    const trigger = this.triggers.get(triggerId);

    assert(trigger);

    return {
      id: trigger.id,
      jobName: trigger.jobName,
      version: trigger.version,
      context: trigger.context,
    };
  }

  public getTriggers(): ConfigSchemaType[] {
    return Array.from(this.triggers).map(([, trigger]) => {
      return {
        id: trigger.id,
        jobName: trigger.jobName,
        version: trigger.version,
        context: trigger.context,
      };
    });
  }

  public getTriggersByJobName(jobName: string): ConfigSchemaType[] {
    if (!this.triggersIndexJobName[jobName]) {
      return [];
    }

    return this.triggersIndexJobName[jobName].map((triggerId) =>
      this.getTrigger(triggerId)
    );
  }

  public async createTrigger(payload: Partial<Omit<ConfigSchemaType, "id">>) {
    console.log(`[Triggers/createTrigger] Creating trigger ${payload.version}`);

    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const id = createToken({
      prefix: "trigger",
    });

    const data = await configSchema.parseAsync({ ...payload, id });

    this.addTrigger(data);

    await Triggers.writeConfigFile(data.jobName, id, data);
  }

  public async deleteTrigger(triggerId: string) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const trigger = this.triggers.get(triggerId);

    assert(trigger);

    this.removeTrigger(triggerId);

    await Triggers.deleteConfigFile(trigger.jobName, trigger.id);
  }

  public async deleteTriggersByJobName(jobName: string) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    assert(this.triggersIndexJobName[jobName]);

    const triggerIds = [...this.triggersIndexJobName[jobName]];

    for (const triggerId of triggerIds) {
      await this.deleteTrigger(triggerId);
    }
  }

  private addTrigger(payload: ConfigSchemaType) {
    const item = {
      ...payload,
    } as TriggerItem;

    if (item.context.type === "schedule") {
      const cronTime = new CronTime(item.context.cron, item.context.timezone);

      item.schedule = {
        cronTime,
        runAt: cronTime.sendAt().toMillis(),
      };
    }

    this.triggers.set(item.id, item);

    if (this.triggersIndexJobName[item.jobName]) {
      this.triggersIndexJobName[item.jobName].push(item.id);
    } else {
      this.triggersIndexJobName[item.jobName] = [item.id];
    }
  }

  private removeTrigger(triggerId: string) {
    const trigger = this.triggers.get(triggerId);

    assert(trigger);

    this.triggers.delete(triggerId);

    assert(this.triggersIndexJobName[trigger.jobName]);

    const index = this.triggersIndexJobName[trigger.jobName].indexOf(triggerId);

    assert(index >= 0);

    const removedIds = this.triggersIndexJobName[trigger.jobName].splice(
      index,
      1
    );
    assert(removedIds.length === 1);
    assert(removedIds[0] === triggerId);

    if (this.triggersIndexJobName[trigger.jobName].length === 0) {
      delete this.triggersIndexJobName[trigger.jobName];
    }
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      try {
        this.loopSchedule();

        await this.loopMqtt();
      } catch (err) {
        console.error(err);
      }

      await timeout(250);
    }

    await this.loopMqttClose();

    this.isLoopRunning = false;
  }

  private loopSchedule() {
    const timestamp = Date.now();

    // WARNING: Don't make this function asynchronous. We iterate over the triggers, and immediately
    // update then with the value we iterate with. If this was an asynchronous method, it would open
    // it to race conditions. Bad. Bad. Bad.

    for (const [triggerId, trigger] of this.triggers) {
      const job = this.job.getJob(trigger.jobName);

      assert(job);

      if (trigger.version !== job.version) {
        continue;
      }

      if (!trigger.schedule || trigger.context.type !== "schedule") {
        continue;
      }

      if (trigger.schedule.runAt > timestamp) {
        continue;
      }

      console.log(
        `[Triggers/onScheduleTick] Schedule starting ${trigger.jobName}, runAt ${trigger.schedule.runAt}`
      );

      this.triggers.set(triggerId, {
        ...trigger,
        schedule: {
          cronTime: trigger.schedule.cronTime,
          runAt: trigger.schedule.cronTime.sendAt().toMillis(),
        },
      });

      if (this.onHandleEvent) {
        this.onHandleEvent(trigger.jobName, {
          type: "schedule",
        });
      }
    }
  }

  private async loopMqttClose() {
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.context.type === "mqtt") {
        if (trigger.mqtt) {
          try {
            await trigger.mqtt.client.endAsync();

            this.triggers.set(triggerId, {
              context: trigger.context,
              id: trigger.id,
              jobName: trigger.jobName,
              version: trigger.version,
            });
          } catch (err) {
            console.log(
              "[Triggers/loopMqttClose] Failed to close mqtt client!"
            );
            console.error(err);
          }
        }
      }
    }
  }

  private async loopMqtt() {
    const jobs = this.job.getJobs();
    for (const job of jobs) {
      const triggers = this.getTriggersByJobName(job.name).map((index) => {
        const trigger = this.triggers.get(index.id);

        assert(trigger);

        return trigger;
      });

      const triggersCurrent = triggers.filter(
        (index) =>
          index.version === job.version && index.context.type === "mqtt"
      );

      const triggersOutdated = triggers.filter(
        (index) =>
          index.version !== job.version && index.context.type === "mqtt"
      );

      // stop old mqtt triggers
      if (triggersOutdated.length > 0) {
        for (const trigger of triggersOutdated) {
          if (trigger.context.type === "mqtt" && trigger.mqtt?.client) {
            await trigger.mqtt.client.endAsync();

            this.triggers.set(trigger.id, {
              ...trigger,
              mqtt: undefined,
            });
          }
        }
      }

      // start new mqtt triggers if they are not already running
      if (triggersCurrent.length > 0) {
        for (const trigger of triggersCurrent) {
          if (trigger.context.type === "mqtt") {
            try {
              const config = this.buildMqttConfig(
                job.name,
                trigger.context.connection
              );

              if (!config.success) {
                console.warn(
                  `[Triggers/loopMqtt] failed to build mqttConfig, jobName ${
                    job.name
                  }, ${shortenString(trigger.id)}, errors: ${config.errors}`
                );

                // TODO : Log when we have some form of logging??

                continue;
              }

              // Handling connection refresh if required.
              if (trigger.mqtt) {
                if (config.configHash === trigger.mqtt.configHash) {
                  continue;
                }

                if (config.configHash !== trigger.mqtt.configHash) {
                  console.log(
                    `[Triggers/loopMqtt] Detected MQTT configuration change. Closing existing MQTT connection. jobName ${
                      job.name
                    }, triggerId ${shortenString(trigger.id)}`
                  );

                  await trigger.mqtt.client.endAsync();
                }
              }

              console.log(
                `[Triggers/loopMqtt] Opening MQTT connection... jobName ${
                  job.name
                }, triggerId ${shortenString(trigger.id)}`
              );

              const client = await connectAsync(config.config);

              this.triggers.set(trigger.id, {
                ...trigger,
                mqtt: {
                  client,
                  configHash: config.configHash,
                },
              });

              client.on("message", async (topic, payload) => {
                console.log(
                  `[Triggers/loopMqtt] MQTT message received. topic ${topic}, jobName ${
                    job.name
                  }, triggerId ${shortenString(trigger.id)}`
                );

                if (!this.onHandleEvent) {
                  return;
                }

                const response = await this.onHandleEvent(trigger.jobName, {
                  type: "mqtt",
                  topic: topic,
                  body: payload.toString("base64"),
                  bodyLength: payload.length,
                });

                if (
                  client.connected &&
                  response.success &&
                  response.mqtt?.publish
                ) {
                  for (const publish of response.mqtt.publish) {
                    await client.publishAsync(publish.topic, publish.body);
                  }
                }
              });

              await client.subscribeAsync(trigger.context.topics);
            } catch (err) {
              console.warn(
                `[Triggers/loopMqtt] error with starting mqtt client, jobName ${
                  job.name
                }, triggerId ${shortenString(trigger.id)}`,
                err
              );

              // TODO : Log when we have better logging
            }
          }
        }
      }
    }
  }

  private buildMqttConfig(
    jobName: string,
    connection: Extract<
      ConfigSchemaType["context"],
      { type: "mqtt" }
    >["connection"]
  ) {
    const result: IClientOptions = {};

    const env = this.job.getEnvironmentVariables(jobName);
    const errors: string[] = [];

    if (connection.clientId) {
      result.clientId = connection.clientId;
    } else if (connection.clientIdVariable) {
      if (env[connection.clientIdVariable]) {
        result.clientId = env[connection.clientIdVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: clientId from  environment failure, ${connection.clientIdVariable} missing`
        );
      }
    }

    if (connection.host) {
      result.host = connection.host;
    } else if (connection.hostVariable) {
      if (env[connection.hostVariable]) {
        result.host = env[connection.hostVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: host from  environment failure, ${connection.hostVariable} missing`
        );
      }
    }

    if (connection.password) {
      result.password = connection.password;
    } else if (connection.passwordVariable) {
      if (env[connection.passwordVariable]) {
        result.password = env[connection.passwordVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: password from  environment failure, ${connection.passwordVariable} missing`
        );
      }
    }

    if (connection.port) {
      result.port = Number(connection.port);
    } else if (connection.portVariable) {
      if (env[connection.portVariable]) {
        result.port = Number(env[connection.portVariable].value);
      } else {
        errors.push(
          `MQTT Config Building: port from  environment failure, ${connection.portVariable} missing`
        );
      }
    }

    if (Number.isNaN(result.port)) {
      errors.push(
        `MQTT Config Building: port from  environment failure, ${connection.portVariable} expected valid number`
      );
    }

    if (connection.protocol) {
      result.protocol = connection.protocol;
    } else if (connection.protocolVariable) {
      if (env[connection.protocolVariable]) {
        result.protocol = env[connection.protocolVariable]
          .value as typeof result.protocol;
      } else {
        errors.push(
          `MQTT Config Building: protocol from  environment failure, ${connection.protocolVariable} missing`
        );
      }
    }

    if (connection.username) {
      result.username = connection.username;
    } else if (connection.usernameVariable) {
      if (env[connection.usernameVariable]) {
        result.username = env[connection.usernameVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: username from  environment failure, ${connection.usernameVariable} missing`
        );
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      } as const;
    }

    return {
      success: true,
      config: result,
      configHash: createSha1Hash(JSON.stringify(result)),
    } as const;
  }

  private static async readConfigFiles(jobName: string) {
    const result: ConfigSchemaType[] = [];

    const directory = getPathJobTriggersDirectory(jobName);
    const files = await readdir(directory);

    for (const file of files) {
      const filename = path.join(directory, file);

      const content = await readFile(filename, "utf8");

      const contentParsed = JSON.parse(content);

      const contentValidated = await configSchema.parseAsync(contentParsed);

      result.push(contentValidated);
    }

    return result;
  }

  private static async writeConfigFile(
    jobName: string,
    triggerId: string,
    content: ConfigSchemaType
  ) {
    const contentValidated = await configSchema.parseAsync(content);

    const directory = getPathJobTriggersDirectory(jobName);

    await mkdir(directory, { recursive: true });

    const filename = getPathJobTriggersFile(jobName, triggerId);

    await writeFile(filename, JSON.stringify(contentValidated, null, 2));
  }

  private static async deleteConfigFile(jobName: string, triggerId: string) {
    const filename = getPathJobTriggersFile(jobName, triggerId);

    await rm(filename);
    console.log("deleting file ", presentablePath(filename));
  }
}
