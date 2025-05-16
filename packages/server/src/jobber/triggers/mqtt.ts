import assert from "assert";
import { awaitTruthy, createSha1Hash, timeout } from "~/util.js";
import { StatusLifecycle } from "../types.js";
import { getDrizzle } from "~/db/index.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { triggersTable, TriggersTableType } from "~/db/schema/triggers.js";
import { RunnerManager } from "../runners/manager.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import {
  environmentsTable,
  EnvironmentsTableType,
} from "~/db/schema/environments.js";
import { connectAsync, IClientOptions, MqttClient } from "mqtt";
import { counterTriggerMqtt } from "~/metrics.js";
import { DecoupledStatus } from "../decoupled-status.js";

type TriggerMqttItem = {
  trigger: TriggersTableType;
  action: ActionsTableType;
  job: JobsTableType;
  environment: EnvironmentsTableType | null;

  client: MqttClient;

  /**
   * Hash of MQTT connection details, used to determine when we need to recreate
   * the MQTT connection
   */
  clientConfigHash: string;
};

export class TriggerMqtt {
  private runnerManager: RunnerManager;

  private decoupledStatus: DecoupledStatus;

  private triggers: Record<string, TriggerMqttItem> = {};

  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

  constructor(runnerManager: RunnerManager, decoupledStatus: DecoupledStatus) {
    this.runnerManager = runnerManager;

    this.decoupledStatus = decoupledStatus;
  }

  public async start() {
    assert(this.status === "neutral");

    this.status = "starting";

    this.loop();

    await awaitTruthy(() => Promise.resolve(this.isLoopRunning));

    this.status = "started";
  }

  public async stop() {
    assert(this.status === "started");

    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      const triggers = await getDrizzle()
        .select({
          trigger: triggersTable,
          action: actionsTable,
          job: jobsTable,
          environment: environmentsTable,
        })
        .from(triggersTable)
        .innerJoin(
          jobsTable,
          and(
            eq(triggersTable.jobId, jobsTable.id),
            eq(triggersTable.version, jobsTable.version)
          )
        )
        .innerJoin(
          actionsTable,
          and(
            eq(actionsTable.jobId, triggersTable.jobId),
            eq(actionsTable.version, triggersTable.version)
          )
        )
        .leftJoin(
          environmentsTable,
          eq(environmentsTable.jobId, triggersTable.jobId)
        )
        .where(
          and(
            isNotNull(jobsTable.version),
            sql`${triggersTable.context} ->> 'type' = 'mqtt'`,
            eq(jobsTable.status, "enabled")
          )
        );

      await this.loopCheckOldTriggers(triggers);
      await this.loopCheckConnection(triggers);
      await this.loopCheckNewTriggers(triggers);

      await timeout(1000);
    }

    await this.loopClose();

    this.isLoopRunning = false;
  }

  /**
   * Handle the event loop closure.
   */
  private async loopClose() {
    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      try {
        await trigger.client.endAsync();

        delete this.triggers[triggerId];
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Checks for any outdated MQTT clients, ends them if there is.
   */
  private async loopCheckOldTriggers(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
      environment: EnvironmentsTableType | null;
    }[]
  ) {
    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      try {
        if (triggersSource.some((index) => index.trigger.id === triggerId)) {
          continue;
        }

        await trigger.client.endAsync();

        delete this.triggers[triggerId];
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Validates triggers and their connection hash, if connection hash has
   * changed, it will end the client.
   */
  private async loopCheckConnection(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
      environment: EnvironmentsTableType | null;
    }[]
  ) {
    for (const triggerSource of triggersSource) {
      try {
        const trigger = this.triggers[triggerSource.trigger.id];

        if (!trigger) {
          continue;
        }

        const config = this.buildMqttConfig(
          triggerSource.trigger,
          triggerSource.environment
        );

        if (!config.success) {
          continue;
        }

        if (
          config.configHash === trigger.clientConfigHash &&
          trigger.client.connected
        ) {
          this.decoupledStatus.setItem(`trigger-id-${trigger.trigger.id}`, {
            message: `Connected`,
          });

          continue;
        }

        this.decoupledStatus.setItem(`trigger-id-${trigger.trigger.id}`, {
          message: `Disconnecting...`,
        });

        await trigger.client.endAsync();

        delete this.triggers[trigger.trigger.id];

        this.decoupledStatus.deleteItem(`trigger-id-${trigger.trigger.id}`);
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Checks if new triggers have been created, and initialise's them if there was.
   */
  private async loopCheckNewTriggers(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
      environment: EnvironmentsTableType | null;
    }[]
  ) {
    for (const triggerSource of triggersSource) {
      try {
        if (this.triggers[triggerSource.trigger.id]) {
          continue;
        }

        assert(triggerSource.trigger.context.type === "mqtt");

        this.decoupledStatus.setItem(`trigger-id-${triggerSource.trigger.id}`, {
          message: `Connecting...`,
        });

        const config = this.buildMqttConfig(
          triggerSource.trigger,
          triggerSource.environment
        );

        if (!config.success) {
          console.warn(
            `[TriggerMqtt/loopCheckNewTriggers] Failed to build MQTT config! Errors...`,
            config.errors
          );

          this.decoupledStatus.setItem(
            `trigger-id-${triggerSource.trigger.id}`,
            {
              message: `Configuration error: ${config.errorsSimple.join(", ")}`,
              level: "error",
            }
          );

          continue;
        }

        const client = await connectAsync(config.config);

        await client.subscribeAsync(triggerSource.trigger.context.topics);

        client.on("message", async (topic, payload) =>
          this.onMqttMessage(triggerSource.trigger.id, topic, payload)
        );

        this.triggers[triggerSource.trigger.id] = {
          trigger: structuredClone(triggerSource.trigger),
          action: structuredClone(triggerSource.action),
          job: structuredClone(triggerSource.job),
          environment: structuredClone(triggerSource.environment),
          client: client,
          clientConfigHash: config.configHash,
        };

        this.decoupledStatus.setItem(`trigger-id-${triggerSource.trigger.id}`, {
          message: `Connected`,
        });
      } catch (err) {
        console.error(err);

        if (err instanceof Error) {
          const code = (err as { code?: string }).code ?? null;

          let message = "Connection error, see logs";

          if (code === "ECONNREFUSED") {
            message = `Connection refused, ECONNREFUSED.`;
          } else if (code === "ENOTFOUND") {
            message = `Connection error, see logs. ENOTFOUND.`;
          } else if (code === "EAI_AGAIN") {
            message = `Connection error, see logs. EAI_AGAIN.`;
          }

          this.decoupledStatus.setItem(
            `trigger-id-${triggerSource.trigger.id}`,
            {
              message,
              level: "error",
            }
          );
        }
      }
    }
  }

  private async onMqttMessage(
    triggerId: string,
    topic: string,
    payload: Buffer
  ) {
    try {
      const triggerItem = this.triggers[triggerId];

      if (!triggerItem) {
        return;
      }

      const handleResponse = await this.runnerManager.sendHandleRequest(
        triggerItem.action,
        triggerItem.job,
        {
          type: "mqtt",
          topic,
          body: payload.toString("base64"),
          bodyLength: payload.length,
        }
      );

      counterTriggerMqtt
        .labels({
          job_id: triggerItem.job.id,
          job_name: triggerItem.job.jobName,
          version: triggerItem.trigger.version,
          success: handleResponse.success ? 1 : 0,
        })
        .inc();

      if (!handleResponse.success) {
        console.log(
          `[TriggerMqtt/onMqttMessage] Sending MQTT handle event failed! ${handleResponse.error}`
        );

        return;
      }

      if (!handleResponse.mqtt) {
        console.log(
          `[TriggerMqtt/onMqttMessage] Did not received MQTT payload on response.`
        );

        return;
      }

      for (const publishItem of handleResponse.mqtt.publish) {
        await triggerItem.client.publishAsync(
          publishItem.topic,
          publishItem.body
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  private buildMqttConfig(
    trigger: TriggersTableType,
    environment: EnvironmentsTableType | null
  ) {
    assert(trigger.context.type === "mqtt");

    const env = environment?.context ?? {};

    const result: IClientOptions = {};

    const errors: string[] = [];
    const errorsSimple: string[] = [];

    if (trigger.context.connection.clientId) {
      result.clientId = trigger.context.connection.clientId;
    } else if (trigger.context.connection.clientIdVariable) {
      if (env[trigger.context.connection.clientIdVariable]) {
        result.clientId =
          env[trigger.context.connection.clientIdVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: clientId from  environment failure, ${trigger.context.connection.clientIdVariable} missing`
        );

        errorsSimple.push(
          `${trigger.context.connection.clientIdVariable} missing`
        );
      }
    }

    if (trigger.context.connection.host) {
      result.host = trigger.context.connection.host;
    } else if (trigger.context.connection.hostVariable) {
      if (env[trigger.context.connection.hostVariable]) {
        result.host = env[trigger.context.connection.hostVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: host from  environment failure, ${trigger.context.connection.hostVariable} missing`
        );

        errorsSimple.push(`${trigger.context.connection.hostVariable} missing`);
      }
    }

    if (trigger.context.connection.password) {
      result.password = trigger.context.connection.password;
    } else if (trigger.context.connection.passwordVariable) {
      if (env[trigger.context.connection.passwordVariable]) {
        result.password =
          env[trigger.context.connection.passwordVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: password from  environment failure, ${trigger.context.connection.passwordVariable} missing`
        );

        errorsSimple.push(
          `${trigger.context.connection.passwordVariable} missing`
        );
      }
    }

    if (trigger.context.connection.port) {
      result.port = Number(trigger.context.connection.port);
    } else if (trigger.context.connection.portVariable) {
      if (env[trigger.context.connection.portVariable]) {
        result.port = Number(
          env[trigger.context.connection.portVariable].value
        );
      } else {
        errors.push(
          `MQTT Config Building: port from  environment failure, ${trigger.context.connection.portVariable} missing`
        );

        errorsSimple.push(`${trigger.context.connection.portVariable} missing`);
      }
    }

    if (Number.isNaN(result.port)) {
      errors.push(
        `MQTT Config Building: port from  environment failure, ${trigger.context.connection.portVariable} expected valid number`
      );

      errorsSimple.push(
        `${trigger.context.connection.portVariable} expected valid number`
      );
    }

    if (trigger.context.connection.protocol) {
      result.protocol = trigger.context.connection.protocol;
    } else if (trigger.context.connection.protocolVariable) {
      if (env[trigger.context.connection.protocolVariable]) {
        result.protocol = env[trigger.context.connection.protocolVariable]
          .value as typeof result.protocol;
      } else {
        errors.push(
          `MQTT Config Building: protocol from  environment failure, ${trigger.context.connection.protocolVariable} missing`
        );

        errorsSimple.push(
          `${trigger.context.connection.protocolVariable} missing`
        );
      }
    }

    if (trigger.context.connection.username) {
      result.username = trigger.context.connection.username;
    } else if (trigger.context.connection.usernameVariable) {
      if (env[trigger.context.connection.usernameVariable]) {
        result.username =
          env[trigger.context.connection.usernameVariable].value;
      } else {
        errors.push(
          `MQTT Config Building: username from  environment failure, ${trigger.context.connection.usernameVariable} missing`
        );

        errorsSimple.push(
          `${trigger.context.connection.usernameVariable} missing`
        );
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        errorsSimple,
      } as const;
    }

    return {
      success: true,
      config: result,
      configHash: createSha1Hash(JSON.stringify(result)),
    } as const;
  }
}
