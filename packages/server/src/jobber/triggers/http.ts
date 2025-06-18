import assert from "assert";
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
import { counterTriggerHttp } from "~/metrics.js";
import { getUnixTimestamp } from "~/util.js";
import { LogDriverBase } from "../log-drivers/abstract.js";
import { RunnerManager } from "../runners/manager.js";
import { HandleRequest, HandleRequestHttp } from "../runners/server.js";

type TriggerHttpItem = {
  trigger: Omit<TriggersTableType, "context"> & {
    context: Extract<TriggersTableType["context"], { type: "http" }>;
  };
  triggerPathRegex?: RegExp;
  triggerPathString?: string;
  action: ActionsTableType;
  version: JobVersionsTableType;
  job: JobsTableType;
};

export class TriggerHttp extends LoopBase {
  protected loopDuration = 1000;
  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private runnerManager: RunnerManager;

  private logger: LogDriverBase;

  private triggers: Record<string, TriggerHttpItem> = {};

  constructor(runnerManager: RunnerManager, logger: LogDriverBase) {
    super();

    this.runnerManager = runnerManager;

    this.logger = logger;
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

    return {
      status: "healthy",
      message: `HTTP Trigger registered for version ${trigger.version.version}`,
    };
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
          sql`${triggersTable.context} ->> 'type' = 'http'`,
          eq(jobsTable.status, "enabled")
        )
      );

    await this.loopCheckNewTriggers(triggers);
    await this.loopCheckOldTriggers(triggers);
  }

  public async sendHandleRequest(
    request: Pick<
      HandleRequestHttp,
      | "body"
      | "bodyLength"
      | "headers"
      | "method"
      | "path"
      | "queries"
      | "query"
    >
  ) {
    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      const headerHost = request.headers["host"];

      if (
        trigger.trigger.context.hostname &&
        trigger.trigger.context.hostname !== headerHost
      ) {
        continue;
      }

      if (
        trigger.trigger.context.method &&
        trigger.trigger.context.method !== request.method
      ) {
        continue;
      }

      if (
        trigger.triggerPathRegex &&
        !trigger.triggerPathRegex.test(request.path)
      ) {
        continue;
      }

      if (
        trigger.triggerPathString &&
        trigger.triggerPathString !== request.path
      ) {
        continue;
      }

      const handleRequest: HandleRequest = {
        ...request,
        type: "http",
        name: trigger.trigger.context.name ?? "",
      };

      const result = await this.runnerManager.sendHandleRequest(
        trigger.version,
        trigger.job,
        trigger.action,
        handleRequest
      );

      if (result.success && result.http?.status) {
        counterTriggerHttp
          .labels({
            host: trigger.trigger.context.hostname ?? "",
            method: trigger.trigger.context.method ?? "",
            path: trigger.trigger.context.path ?? "",
            request_host: headerHost ?? "",
            request_method: handleRequest.method,
            request_path: handleRequest.path,

            job_id: trigger.job.id,
            job_name: trigger.job.jobName,
            version: trigger.version.version,

            status_code: result.http.status,
          })
          .inc();
      }

      return result;
    }

    return null;
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

      assert(triggerSource.trigger.context.type === "http");

      let triggerPathRegex: RegExp | undefined;
      let triggerPathString: string | undefined;

      if (triggerSource.trigger.context?.path) {
        const pathString = triggerSource.trigger.context.path;

        if (pathString.startsWith("^")) {
          triggerPathRegex = new RegExp(pathString);
        } else {
          triggerPathString = pathString;
        }
      }

      this.triggers[triggerSource.trigger.id] = {
        trigger: structuredClone(
          triggerSource.trigger
        ) as TriggerHttpItem["trigger"],
        triggerPathRegex,
        triggerPathString,
        action: structuredClone(triggerSource.action),
        version: structuredClone(triggerSource.version),
        job: structuredClone(triggerSource.job),
      };

      this.logger.write({
        source: "system",
        jobId: triggerSource.job.id,
        jobName: triggerSource.job.jobName,
        actionId: triggerSource.action.id,
        message: `[SYSTEM] HTTP trigger (version: ${triggerSource.version.version}) ${triggerSource.trigger.id} registered`,
        created: getUnixTimestamp(),
      });
    }
  }

  /**
   * Attempts to remove any old triggers.
   */
  private async loopCheckOldTriggers(
    triggersSource: {
      version: JobVersionsTableType;
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

      this.logger.write({
        source: "system",
        jobId: trigger.job.id,
        jobName: trigger.job.jobName,
        actionId: trigger.action.id,
        message: `[SYSTEM] HTTP trigger (version: ${trigger.version.version}) ${triggerId} removed`,
        created: getUnixTimestamp(),
      });
    }
  }
}
