import assert from "assert";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { connectAsync, IClientOptions, MqttClient } from "mqtt";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import {
  environmentsTable,
  EnvironmentsTableType,
} from "~/db/schema/environments.js";
import {
  jobVersionsTable,
  JobVersionsTableType,
} from "~/db/schema/job-versions.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { triggersTable, TriggersTableType } from "~/db/schema/triggers.js";
import { LoopBase } from "~/loop-base.js";
import { counterTriggerMqtt, counterTriggerMqttPublish } from "~/metrics.js";
import { createSha1Hash } from "~/util.js";
import { LogDriverBase } from "../log-drivers/abstract.js";
import { RunnerManager } from "../runners/manager.js";
import { autoInjectable, inject, singleton } from "tsyringe";

type TriggerMqttItem = {
  trigger: TriggersTableType;
  action: ActionsTableType;
  version: JobVersionsTableType;
  job: JobsTableType;
  environment: EnvironmentsTableType | null;

  client: MqttClient;

  /**
   * Hash of MQTT connection details, used to determine when we need to recreate
   * the MQTT connection
   */
  clientConfigHash: string;
};

@singleton()
export class TriggerMqtt extends LoopBase {
  protected loopDuration = 1000;
  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;

  private triggers: Record<string, TriggerMqttItem> = {};

  constructor(
    @inject(RunnerManager) private runnerManager: RunnerManager,
    @inject("LogDriverBase") private logger: LogDriverBase
  ) {
    super();
  }

  public async getTriggerStatus(jobId: string, triggerId: string) {
    const trigger = this.triggers[triggerId];

    if (!trigger || trigger.job.id !== jobId) {
      return {
        status: "unknown",
        message: "unknown",
      };
    }

    if (this.status !== "started") {
      return {
        status: "unhealthy",
        message: "Cron not running",
      };
    }

    if (trigger.client.disconnecting) {
      return {
        status: "unhealthy",
        message: "Disconnecting...",
      };
    }

    if (trigger.client.disconnected) {
      return {
        status: "unhealthy",
        message: "Disconnected",
      };
    }

    if (trigger.client.reconnecting) {
      return {
        status: "unhealthy",
        message: "Reconnecting...",
      };
    }

    if (trigger.client.connected) {
      return {
        status: "healthy",
        message: `Connected`,
      };
    }

    return {
      status: "unhealthy",
      message: "Unknown connection status",
    };
  }

  protected async loopIteration() {
    const triggers = await getDrizzle()
      .select({
        trigger: triggersTable,
        version: jobVersionsTable,
        action: actionsTable,
        job: jobsTable,
        environment: environmentsTable,
      })
      .from(triggersTable)
      .innerJoin(
        jobVersionsTable,
        and(
          eq(triggersTable.jobId, jobVersionsTable.jobId),
          eq(triggersTable.jobVersionId, jobVersionsTable.id)
        )
      )
      .innerJoin(
        jobsTable,
        and(
          eq(triggersTable.jobId, jobsTable.id),
          eq(triggersTable.jobVersionId, jobsTable.jobVersionId)
        )
      )
      .innerJoin(
        actionsTable,
        and(
          eq(triggersTable.jobId, actionsTable.jobId),
          eq(triggersTable.jobVersionId, actionsTable.jobVersionId)
        )
      )
      .leftJoin(
        environmentsTable,
        eq(environmentsTable.jobId, triggersTable.jobId)
      )
      .where(
        and(
          isNotNull(jobsTable.jobVersionId),
          sql`${triggersTable.context} ->> 'type' = 'mqtt'`,
          eq(jobsTable.status, "enabled")
        )
      );

    await this.loopCheckOldTriggers(triggers);
    await this.loopCheckConnection(triggers);
    await this.loopCheckNewTriggers(triggers);
  }

  /**
   * Handle the event loop closure.
   */
  protected async loopClosed() {
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

        this.logger.write({
          source: "system",
          actionId: trigger.action.id,
          jobId: trigger.job.id,
          jobName: trigger.job.jobName,
          message: `[SYSTEM] MQTT disconnection process started for trigger (version: ${trigger.version.version}) "${triggerId}"`,
          created: new Date(),
        });

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
      const trigger = this.triggers[triggerSource.trigger.id];

      if (!trigger) {
        continue;
      }

      try {
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
          continue;
        }

        this.logger.write({
          source: "system",
          actionId: triggerSource.action.id,
          jobId: triggerSource.job.id,
          jobName: triggerSource.job.jobName,
          message: `[SYSTEM] MQTT disconnection process started, connection dropped or config changed`,
          created: new Date(),
        });

        await trigger.client.endAsync();

        delete this.triggers[trigger.trigger.id];
      } catch (err) {
        console.error(err);

        this.logger.write({
          source: "system",
          actionId: triggerSource.action.id,
          jobId: triggerSource.job.id,
          jobName: triggerSource.job.jobName,
          message: `[SYSTEM] MQTT connection check error! ${
            err instanceof Error ? err.message : String(err)
          }`,
          created: new Date(),
        });
      }
    }
  }

  /**
   * Checks if new triggers have been created, and initialise's them if there was.
   */
  private async loopCheckNewTriggers(
    triggersSource: {
      version: JobVersionsTableType;
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

        const config = this.buildMqttConfig(
          triggerSource.trigger,
          triggerSource.environment
        );

        if (!config.success) {
          console.warn(
            `[TriggerMqtt/loopCheckNewTriggers] Failed to build MQTT config! Errors...`,
            config.errors
          );

          this.logger.write({
            source: "system",
            actionId: triggerSource.action.id,
            jobId: triggerSource.job.id,
            jobName: triggerSource.job.jobName,
            message: `[SYSTEM] MQTT Initialisation error! Configuration error: ${config.errorsSimple.join(
              ", "
            )}`,
            created: new Date(),
          });

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
          version: structuredClone(triggerSource.version),
          job: structuredClone(triggerSource.job),
          environment: structuredClone(triggerSource.environment),
          client: client,
          clientConfigHash: config.configHash,
        };
      } catch (err) {
        console.error(err);

        if (err instanceof Error) {
          const code = (err as { code?: string })?.code ?? null;

          let message = "Connection error, see logs";

          if (code === "ECONNREFUSED") {
            message = `Connection refused, ECONNREFUSED.`;
          } else if (code === "ENOTFOUND") {
            message = `Connection error, see logs. ENOTFOUND.`;
          } else if (code === "EAI_AGAIN") {
            message = `Connection error, see logs. EAI_AGAIN.`;
          }

          this.logger.write({
            source: "system",
            actionId: triggerSource.action.id,
            jobId: triggerSource.job.id,
            jobName: triggerSource.job.jobName,
            message: `[SYSTEM] MQTT Initialisation error! ${message}`,
            created: new Date(),
          });
        }
      }
    }
  }

  private async onMqttMessage(
    triggerId: string,
    topic: string,
    payload: Buffer
  ) {
    const triggerItem = this.triggers[triggerId];

    if (!triggerItem) {
      return;
    }

    try {
      this.logger.write({
        source: "system",
        actionId: triggerItem.action.id,
        jobId: triggerItem.job.id,
        jobName: triggerItem.job.jobName,
        message: `[SYSTEM] MQTT message received on topic "${topic}"`,
        created: new Date(),
      });

      const handleResponse = await this.runnerManager.sendHandleRequest(
        triggerItem.version,
        triggerItem.job,
        triggerItem.action,
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
          version: triggerItem.version.version,
          success: handleResponse.success ? 1 : 0,
        })
        .inc();

      if (!handleResponse.success) {
        console.log(
          `[TriggerMqtt/onMqttMessage] Sending MQTT handle event failed! topic "${topic}", error: ${handleResponse.error}`
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
        try {
          if (!triggerItem.client.connected) {
            console.warn(
              `[TriggerMqtt/onMqttMessage] MQTT client is not connected, cannot publish message to topic "${publishItem.topic}"`
            );

            this.logger.write({
              source: "system",
              actionId: triggerItem.action.id,
              jobId: triggerItem.job.id,
              jobName: triggerItem.job.jobName,
              message: `[SYSTEM] MQTT client is not connected, cannot publish message to topic "${publishItem.topic}"`,
              created: new Date(),
            });

            continue;
          }

          this.logger.write({
            source: "system",
            actionId: triggerItem.action.id,
            jobId: triggerItem.job.id,
            jobName: triggerItem.job.jobName,
            message: `[SYSTEM] MQTT message published to topic "${publishItem.topic}"`,
            created: new Date(),
          });

          counterTriggerMqttPublish
            .labels({
              job_id: triggerItem.job.id,
              job_name: triggerItem.job.jobName,
              version: triggerItem.version.version,
              topic: publishItem.topic,
            })
            .inc();

          await triggerItem.client.publishAsync(
            publishItem.topic,
            publishItem.body
          );
        } catch (err) {
          console.error(err);

          this.logger.write({
            source: "system",
            actionId: triggerItem.action.id,
            jobId: triggerItem.job.id,
            jobName: triggerItem.job.jobName,
            message: `[SYSTEM] MQTT publish error! topic: ${
              publishItem.topic
            }, ${err instanceof Error ? err.message : String(err)}`,
            created: new Date(),
          });
        }
      }
    } catch (err) {
      console.error(err);

      this.logger.write({
        source: "system",
        actionId: triggerItem.action.id,
        jobId: triggerItem.job.id,
        jobName: triggerItem.job.jobName,
        message: `[SYSTEM] MQTT message handling error! ${
          err instanceof Error ? err.message : String(err)
        }`,
        created: new Date(),
      });
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
