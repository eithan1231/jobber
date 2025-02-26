import assert from "assert";
import { CronTime } from "cron";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { triggersTable, TriggersTableType } from "~/db/schema/triggers.js";
import { awaitTruthy, timeout } from "~/util.js";
import { RunnerManager } from "../runners/manager.js";
import { StatusLifecycle } from "../types.js";
import { counterTriggerCron } from "~/metrics.js";

type TriggerCronItem = {
  trigger: TriggersTableType;
  action: ActionsTableType;
  job: JobsTableType;
  cron: CronTime;
  scheduledAt: number;
};

export class TriggerCron {
  private runnerManager: RunnerManager;

  private triggers: Record<string, TriggerCronItem> = {};

  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

  constructor(runnerManager: RunnerManager) {
    this.runnerManager = runnerManager;
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
        .where(
          and(
            isNotNull(jobsTable.version),
            sql`${triggersTable.context} ->> 'type' = 'schedule'`,
            eq(jobsTable.status, "enabled")
          )
        );

      await this.loopCheckNewTriggers(triggers);
      await this.loopCheckOldTriggers(triggers);
      await this.loopCheckTriggers(triggers);

      await timeout(1000);
    }

    this.isLoopRunning = false;
  }

  /**
   * Attempts to start any newly created triggers.
   */
  private async loopCheckNewTriggers(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const triggerSource of triggersSource) {
      if (this.triggers[triggerSource.trigger.id]) {
        continue;
      }

      assert(triggerSource.trigger.context.type === "schedule");

      const cron = new CronTime(
        triggerSource.trigger.context.cron,
        triggerSource.trigger.context.timezone
      );

      this.triggers[triggerSource.trigger.id] = {
        trigger: structuredClone(triggerSource.trigger),
        action: structuredClone(triggerSource.action),
        job: structuredClone(triggerSource.job),
        cron: cron,
        scheduledAt: cron.sendAt().toMillis(),
      };
    }
  }

  /**
   * Attempts to remove any old triggers.
   */
  private async loopCheckOldTriggers(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      if (triggersSource.some((index) => index.trigger.id === triggerId)) {
        continue;
      }

      delete this.triggers[triggerId];
    }
  }

  /**
   * Checks if there are any schedules that need invoking
   */
  private async loopCheckTriggers(
    triggersSource: {
      trigger: TriggersTableType;
      action: ActionsTableType;
      job: JobsTableType;
    }[]
  ) {
    const time = Date.now();

    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      if (trigger.scheduledAt > time) {
        continue;
      }

      trigger.scheduledAt = trigger.cron.sendAt().toMillis();

      this.runnerManager
        .sendHandleRequest(trigger.action, trigger.job, {
          type: "schedule",
        })
        .then((handleResponse) => {
          counterTriggerCron
            .labels({
              job_id: trigger.job.id,
              job_name: trigger.job.jobName,
              version: trigger.trigger.version,
              success: handleResponse.success ? 1 : 0,
            })
            .inc();

          if (!handleResponse.success) {
            console.log(
              `[TriggerCron/loopCheckTriggers] Sending schedule handle event failed! ${handleResponse.error}`
            );

            return;
          }
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }
}
