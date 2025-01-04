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

export class LogDriverLoki extends LogDriverBase {
  private options: LogDriverLokiOptions;

  constructor(options: LogDriverLokiOptions) {
    super();

    this.options = options;
  }

  protected async flushChunk(logs: LogDriverBaseItem[]): Promise<void> {
    const streams: Record<string, LogDriverBaseItem[]> = {};

    for (const log of logs) {
      const streamName = `${log.jobId}:${log.actionId}`;

      if (streams[streamName]) {
        streams[streamName].push(log);
      } else {
        streams[streamName] = [log];
      }
    }

    const body: {
      streams: Array<{
        stream: Record<string, string>;
        values: Array<[string, string]>;
      }>;
    } = { streams: [] };

    for (const stream of Object.values(streams)) {
      const actionId = stream[0].actionId;
      const jobId = stream[0].jobId;
      const source = stream[0].source;

      body.streams.push({
        stream: {
          jobberJobId: jobId,
          jobberActionId: actionId,
          jobberSource: source,
        },
        values: stream.map((line) => {
          return [(line.created * 1000 * 1000 * 1000).toString(), line.message];
        }),
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
          created: Math.round(Number(itemTime) / 1000 / 1000 / 1000),
          message: itemMessage,
        });
      }
    }

    return result;
  }

  public isQueryEnabled(): boolean {
    return true;
  }

  protected async cleanup(): Promise<void> {
    //
  }
}
