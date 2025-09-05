import { desc, eq, gt, lt, sql } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { logsTable, LogsTableInsertType } from "~/db/schema/logs.js";
import {
  LogDriverBase,
  LogDriverBaseItem,
  LogDriverBaseQuery,
  LogDriverBaseQueryItem,
} from "./abstract.js";

export class LogDriverDatabase extends LogDriverBase {
  private jobSequences: Record<
    string,
    {
      msGroup: number;
      sequence: number;
    }
  > = {};

  protected async flushChunk(logs: LogDriverBaseItem[]): Promise<void> {
    if (!logs.length) {
      return;
    }

    let chunk = new Set<LogsTableInsertType>();

    for (let i = 0; i < logs.length; i += 1000) {
      const logBatch = logs.slice(i, i + 1000);

      for (const log of logBatch) {
        const ms = log.created.getTime();

        this.jobSequences[log.jobId] ??= { msGroup: ms, sequence: -1 };

        if (this.jobSequences[log.jobId].msGroup === ms) {
          this.jobSequences[log.jobId].sequence += 1;
        } else if (
          !this.jobSequences[log.jobId].msGroup ||
          this.jobSequences[log.jobId].msGroup < ms
        ) {
          this.jobSequences[log.jobId].msGroup = ms;
          this.jobSequences[log.jobId].sequence = -1;
        } else {
          // When we receive a LOT of logs per second, meaning thousands. We reach this
          // condition. I assume its related to back-pressure in the event loop. Coding
          // a fix here for this will have a negative performance impact.
        }

        const sort = `${ms.toString().padStart(13, "0")}${this.jobSequences[
          log.jobId
        ].sequence
          .toString()
          .padStart(6, "0")}`;
        //

        chunk.add({
          actionId: log.actionId,
          created: log.created,
          jobId: log.jobId,
          source: log.source,
          message:
            log.message.indexOf("\x00") >= 0
              ? log.message.replace(/\x00/g, "")
              : log.message,
          sort: sort,
        });
      }

      await getDrizzle().insert(logsTable).values(logBatch);

      chunk.clear();
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
        sort: logsTable.sort,
      })
      .from(logsTable)
      .where(eq(logsTable.jobId, query.jobId))
      .orderBy(desc(logsTable.sort))
      .offset(offset)
      .limit(count);
    //

    return logs.map((log) => {
      return {
        sort: log.sort,
        created: log.created,
        message: log.message,
      };
    });
  }

  public isQueryEnabled(): boolean {
    return true;
  }

  protected async cleanup(): Promise<void> {
    await getDrizzle()
      .delete(logsTable)
      .where(lt(logsTable.created, sql`NOW() - INTERVAL '7 days'`));
    //
  }
}
