import assert from "assert";
import { awaitTruthy, timeout } from "~/util.js";
import { StatusLifecycle } from "./types.js";
import { logsTable, LogsTableInsertType } from "~/db/schema/logs.js";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { inArray } from "drizzle-orm";
import { jobsTable } from "~/db/schema/jobs.js";

type LogItem = Omit<LogsTableInsertType, "id">;

export class Logger {
  private logs = new Array<LogItem>();

  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

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

  public write(log: LogItem) {
    this.logs.push(log);
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      this.flushLogs();

      await timeout(2500);
    }

    this.flushLogs();

    this.isLoopRunning = false;
  }

  private async flushLogs() {
    const logsToFlush = this.logs.splice(0);

    if (logsToFlush.length <= 0) {
      return;
    }

    while (logsToFlush.length > 0) {
      const logs = logsToFlush.splice(0, 1000);

      const jobIds = new Set<string>();
      const actionIds = new Set<string>();

      for (const log of logs) {
        if (log.jobId && !jobIds.has(log.jobId)) {
          jobIds.add(log.jobId);
        }

        if (log.actionId && !actionIds.has(log.actionId)) {
          actionIds.add(log.actionId);
        }
      }

      const validActionIds = await getDrizzle()
        .select({
          id: actionsTable.id,
        })
        .from(actionsTable)
        .where(inArray(actionsTable.id, [...actionIds.values()]));

      const validJobIds = await getDrizzle()
        .select({
          id: jobsTable.id,
        })
        .from(jobsTable)
        .where(inArray(jobsTable.id, [...jobIds.values()]));

      const logsValid: LogItem[] = [];

      for (const log of logs) {
        if (!log.message) {
          continue;
        }

        const validActionId = validActionIds.some(
          (index) => index.id === log.actionId
        );

        const validJobId = validJobIds.some((index) => index.id === log.jobId);

        if (validActionId && validJobId) {
          logsValid.push(log);
        }
      }

      if (logsValid.length <= 0) {
        continue;
      }

      await getDrizzle().insert(logsTable).values(logsValid);
    }
  }
}
