import assert from "assert";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { triggersTable, TriggersTableType } from "~/db/schema/triggers.js";
import { awaitTruthy, timeout } from "~/util.js";
import { RunnerManager } from "../runners/manager.js";
import { StatusLifecycle } from "../types.js";
import { HandleRequestHttp } from "../runners/server.js";
import { counterTriggerHttp } from "~/metrics.js";

type TriggerHttpItem = {
  trigger: Omit<TriggersTableType, "context"> & {
    context: Extract<TriggersTableType["context"], { type: "http" }>;
  };
  triggerPathRegex?: RegExp;
  triggerPathString?: string;
  action: ActionsTableType;
  job: JobsTableType;
};

export class TriggerHttp {
  private runnerManager: RunnerManager;

  private triggers: Record<string, TriggerHttpItem> = {};

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

  public async sendHandleRequest(handleRequest: HandleRequestHttp) {
    for (const [triggerId, trigger] of Object.entries(this.triggers)) {
      const headerHost = handleRequest.headers["host"];

      if (
        trigger.trigger.context.hostname &&
        trigger.trigger.context.hostname !== headerHost
      ) {
        continue;
      }

      if (
        trigger.trigger.context.method &&
        trigger.trigger.context.method !== handleRequest.method
      ) {
        continue;
      }

      if (
        trigger.triggerPathRegex &&
        !trigger.triggerPathRegex.test(handleRequest.path)
      ) {
        continue;
      }

      if (
        trigger.triggerPathString &&
        trigger.triggerPathString !== handleRequest.path
      ) {
        continue;
      }

      const result = await this.runnerManager.sendHandleRequest(
        trigger.action,
        trigger.job,
        handleRequest
      );

      if (result.success && result.http?.status) {
        counterTriggerHttp
          .labels({
            host: trigger.trigger.context.hostname ?? undefined,
            method: trigger.trigger.context.method ?? undefined,
            path: trigger.trigger.context.path ?? undefined,

            job_id: trigger.job.id,
            job_name: trigger.job.jobName,
            version: trigger.trigger.version,

            status_code: result.http.status,
          })
          .inc();
      }

      return result;
    }

    return null;
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
            sql`${triggersTable.context} ->> 'type' = 'http'`,
            eq(jobsTable.status, "enabled")
          )
        );

      await this.loopCheckNewTriggers(triggers);
      await this.loopCheckOldTriggers(triggers);

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
        job: structuredClone(triggerSource.job),
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
}
