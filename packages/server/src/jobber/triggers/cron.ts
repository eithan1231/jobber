import assert from "assert";
import { CronTime } from "cron";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import {
  jobVersionsTable,
  JobVersionsTableType,
} from "~/db/schema/job-versions.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { triggersTable, TriggersTableType } from "~/db/schema/triggers.js";
import { LoopBase } from "~/loop-base.js";
import { counterTriggerCron } from "~/metrics.js";
import { DecoupledStatus } from "../decoupled-status.js";
import { LogDriverBase } from "../log-drivers/abstract.js";
import { RunnerManager } from "../runners/manager.js";

type TriggerCronItem = {
  trigger: TriggersTableType;
  version: JobVersionsTableType;
  action: ActionsTableType;
  job: JobsTableType;
  cron: CronTime;
  scheduledAt: number;
};

export class TriggerCron extends LoopBase {
  protected loopDuration = 1000;
  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private runnerManager: RunnerManager;

  private logger: LogDriverBase;

  private decoupledStatus: DecoupledStatus;

  private triggers: Record<string, TriggerCronItem> = {};

  constructor(
    runnerManager: RunnerManager,
    logger: LogDriverBase,
    decoupledStatus: DecoupledStatus
  ) {
    super();

    this.runnerManager = runnerManager;

    this.logger = logger;

    this.decoupledStatus = decoupledStatus;
  }

  protected async loopIteration() {
    const triggers = await getDrizzle()
      .select({
        trigger: triggersTable,
        version: jobVersionsTable,
        action: actionsTable,
        job: jobsTable,
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
      .where(
        and(
          isNotNull(jobsTable.jobVersionId),
          sql`${triggersTable.context} ->> 'type' = 'schedule'`,
          eq(jobsTable.status, "enabled")
        )
      );

    await this.loopCheckNewTriggers(triggers);
    await this.loopCheckOldTriggers(triggers);
    await this.loopCheckTriggers(triggers);
  }

  /**
   * Attempts to start any newly created triggers.
   */
  private async loopCheckNewTriggers(
    triggersSource: {
      version: JobVersionsTableType;
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
        version: structuredClone(triggerSource.version),
        job: structuredClone(triggerSource.job),
        cron: cron,
        scheduledAt: cron.sendAt().toMillis(),
      };

      this.decoupledStatus.setItem(`trigger-id-${triggerSource.trigger.id}`, {
        message: "Cron trigger registered",
      });
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

      this.decoupledStatus.deleteItem(`trigger-id-${triggerId}`);
    }
  }

  /**
   * Checks if there are any schedules that need invoking
   */
  private async loopCheckTriggers(
    triggersSource: {
      version: JobVersionsTableType;
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

      assert(trigger.trigger.context.type === "schedule");

      this.runnerManager
        .sendHandleRequest(trigger.version, trigger.job, trigger.action, {
          type: "schedule",
          name: trigger.trigger.context.name,
          cron: trigger.trigger.context.cron,
          timezone: trigger.trigger.context.timezone,
        })
        .then((handleResponse) => {
          counterTriggerCron
            .labels({
              job_id: trigger.job.id,
              job_name: trigger.job.jobName,
              version: trigger.version.version,
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
