import { getConfigOption } from "~/config.js";
import { getUnixTimestamp } from "~/util.js";
import {
  LogDriverBase,
  LogDriverBaseItem,
  LogDriverBaseQuery,
  LogDriverBaseQueryItem,
} from "./abstract.js";

export type LogDriverLokiOptions = {
  pushUrl: string;
  queryUrl: string;
};

type LokiQueryResult =
  | {
      status: "success";
      data:
        | {
            resultType: "streams";
            result: Array<{
              stream: Record<string, string>;
              values: Array<[time: string, message: string]>;
            }>;
          }
        | {
            resultType: "?";
            result: unknown;
          };
    }
  | {
      status: "?";
      data: unknown;
    };
//

export class LogDriverLoki extends LogDriverBase {
  private jobSequences: Record<
    string,
    {
      msGroup: number;
      sequence: number;
    }
  > = {};

  private options: LogDriverLokiOptions;

  constructor(options: LogDriverLokiOptions) {
    super();

    this.options = options;
  }

  protected async flushChunk(logs: LogDriverBaseItem[]): Promise<void> {
    const streams: Record<
      string,
      {
        stream: Record<string, string>;
        values: Array<[string, string]>;
      }
    > = {};

    for (const log of logs) {
      const streamName = `${log.jobId}:${log.actionId}`;

      if (this.jobSequences[log.jobId] === undefined) {
        this.jobSequences[log.jobId] = {
          msGroup: 0,
          sequence: -1,
        };
      }

      if (this.jobSequences[log.jobId].msGroup === log.created.getTime()) {
        this.jobSequences[log.jobId].sequence++;
      } else if (
        !this.jobSequences[log.jobId].msGroup ||
        this.jobSequences[log.jobId].msGroup < log.created.getTime()
      ) {
        this.jobSequences[log.jobId].msGroup = log.created.getTime();
        this.jobSequences[log.jobId].sequence = 0;
      } else {
        // When we receive a LOT of logs per second, meaning thousands. We reach this
        // condition. I assume its related to back-pressure in the event loop. Coding
        // a fix here for this will have a negative performance impact.
      }

      // ask me about my sanity, i dare you.
      const timestamp = `${this.jobSequences[log.jobId].msGroup
        .toString()
        .padStart(13, "0")}${this.jobSequences[log.jobId].sequence
        .toString()
        .padStart(6, "0")}`;

      const message =
        log.message.indexOf("\x00") >= 0
          ? log.message.replace(/\x00/g, "")
          : log.message;

      if (streams[streamName]) {
        streams[streamName].values.push([timestamp, message]);
      } else {
        streams[streamName] = {
          stream: {
            jobberJobId: log.jobId,
            jobberActionId: log.actionId,
            jobberSource: log.source,
          },
          values: [[timestamp, message]],
        };
      }
    }

    const body: {
      streams: Array<{
        stream: Record<string, string>;
        values: Array<[string, string]>;
      }>;
    } = { streams: [] };

    for (const { stream, values } of Object.values(streams)) {
      body.streams.push({
        stream: stream,
        values: values,
      });
    }

    const response = await fetch(this.options.pushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    if (response.status !== 204) {
      console.warn(
        `[LogDriverLoki/flushChunk] Received unexpected status code ${response.status}, body: ${data}`
      );
    }
  }

  public async query(
    query: LogDriverBaseQuery
  ): Promise<LogDriverBaseQueryItem[]> {
    const params = new URLSearchParams();

    const parts: string[] = [];

    if (query.jobId) {
      parts.push(`jobberJobId=${JSON.stringify(query.jobId)}`);
    }

    if (query.actionId) {
      parts.push(`jobberActionId=${JSON.stringify(query.actionId)}`);
    }

    params.set("query", `{${parts.join(", ")}}`);
    params.set("limit", "128");
    params.set(
      "start",
      `${getUnixTimestamp() - getConfigOption("LOG_DRIVER_LOKI_QUERY_RANGE")}`
    );

    const response = await fetch(
      `${this.options.queryUrl}?${params.toString()}`,
      {}
    );

    const responseJson: LokiQueryResult = await response.json();

    if (responseJson.status !== "success") {
      console.warn(
        `[LogDriverLoki/query] Failed, returned unknown status ${responseJson.status}`
      );

      return [];
    }

    if (responseJson.data.resultType !== "streams") {
      console.warn(
        `[LogDriverLoki/query] Failed, returned unknown resultType ${responseJson.data.resultType}`
      );

      return [];
    }

    const result: LogDriverBaseQueryItem[] = [];

    for (const stream of responseJson.data.result) {
      for (const [itemTime, itemMessage] of stream.values) {
        result.push({
          created: new Date(Math.round(Number(itemTime) / 1000 / 1000)),
          message: itemMessage,
        });
      }
    }

    return result.reverse();
  }

  public isQueryEnabled(): boolean {
    return true;
  }

  protected async cleanup(): Promise<void> {
    //
  }
}
