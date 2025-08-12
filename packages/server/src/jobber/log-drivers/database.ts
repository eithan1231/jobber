import { desc, eq } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { logsTable } from "~/db/schema/logs.js";
import {
  LogDriverBase,
  LogDriverBaseItem,
  LogDriverBaseQuery,
  LogDriverBaseQueryItem,
} from "./abstract.js";

export class LogDriverDatabase extends LogDriverBase {
  protected async flushChunk(logs: LogDriverBaseItem[]): Promise<void> {
    while (logs.length >= 1) {
      const iteration = logs.splice(0, 1000).map((log) => {
        if (log.message.includes("\x00")) {
          log.message = log.message.replace(/\x00/g, "");
        }

        return log;
      });

      await getDrizzle().insert(logsTable).values(iteration);
    }
  }

  public async query(
    query: LogDriverBaseQuery
  ): Promise<LogDriverBaseQueryItem[]> {
    const page = 1; // TODO: this

    const count = 128;
    const offset = (page - 1) * count;

    const logs = await getDrizzle()
      .select({
        jobId: logsTable.jobId,
        actionId: logsTable.actionId,
        source: logsTable.source,
        created: logsTable.created,
        message: logsTable.message,
      })
      .from(logsTable)
      .where(eq(logsTable.jobId, query.jobId))
      .orderBy(desc(logsTable.created))
      .offset(offset)
      .limit(count);

    return logs.map((log) => {
      return {
        created: log.created,
        message: log.message,
      };
    });
  }

  public isQueryEnabled(): boolean {
    return true;
  }

  protected async cleanup(): Promise<void> {
    //
  }
}
