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

type TriggerHttpItem = {
  trigger: Omit<TriggersTableType, "context"> & {
    context: Extract<TriggersTableType["context"], { type: "http" }>;
  };
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
        !trigger.trigger.context.hostname.includes(headerHost)
      ) {
        continue;
      }

      if (
        trigger.trigger.context.method &&
        !trigger.trigger.context.method.includes(handleRequest.method)
      ) {
        continue;
      }

      if (
        trigger.trigger.context.path &&
        !trigger.trigger.context.path.includes(handleRequest.path)
      ) {
        continue;
      }

      return await this.runnerManager.sendHandleRequest(
        trigger.action,
        handleRequest
      );
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
        .innerJoin(jobsTable, eq(triggersTable.jobId, jobsTable.id))
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
            sql`${triggersTable.context} ->> 'type' = 'http'`
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

      this.triggers[triggerSource.trigger.id] = {
        trigger: structuredClone(
          triggerSource.trigger
        ) as TriggerHttpItem["trigger"],
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
