import { TcpFrameSocket } from "@jobber/tcp-frame-socket";
import EventEmitter from "events";
import { readFile } from "fs/promises";
import { Server } from "net";
import { getConfigOption } from "~/config.js";
import { ActionsTableType } from "~/db/schema/actions.js";
import { JobVersionsTableType } from "~/db/schema/job-versions.js";
import { getJobActionArchiveFile } from "~/paths.js";
import { awaitTruthy, createToken, shortenString } from "~/util.js";
import { Store } from "../store.js";

export type HandleRequestHttp = {
  type: "http";
  headers: Record<string, string>;
  query: Record<string, string>;
  queries: Record<string, string[]>;
  path: string;
  method: string;
  body: string;
  bodyLength: number;
};

export type HandleRequestMqtt = {
  type: "mqtt";
  topic: string;
  body: string;
  bodyLength: number;
};

export type HandleRequest =
  | { type: "schedule" }
  | HandleRequestHttp
  | HandleRequestMqtt;

export type HandleResponse = (
  | {
      success: true;
      http?: {
        status: number;
        headers: Record<string, string>;
        body: Buffer;
      };
      mqtt?: {
        publish: Array<{
          topic: string;
          body: Buffer;
        }>;
      };
    }
  | { success: false; error: string }
) & {
  duration: number;
};

type RunnerServerItem = {
  runnerId: string;
  action: ActionsTableType;
  version: JobVersionsTableType;
} & (
  | {
      status: "pending";
    }
  | {
      status: "starting" | "ready" | "closing";
      socket: TcpFrameSocket;
    }
);

type FrameJson = {
  runnerId: string;
  name: string;
  traceId: string;
  dataType: "buffer" | "json";
};

export class RunnerServer extends EventEmitter<{
  "runner-close": [runnerId: string];
  "runner-closing": [runnerId: string];
  "runner-starting": [runnerId: string];
  "runner-ready": [runnerId: string];
}> {
  private connections = new Map<string, RunnerServerItem>();

  private traceResponses = new Map<
    string,
    (frame: FrameJson, data: Buffer) => void
  >();

  private server: Server;

  private store: Store;

  constructor(store: Store) {
    super();

    this.store = store;

    this.server = new Server({
      noDelay: true,
    });

    this.server.on("connection", (socket) => {
      const socketFrame = new TcpFrameSocket(socket);

      socketFrame.on("frame", (buffer) => this.onFrame(socketFrame, buffer));
    });

    this.server.on("error", (err) => console.error(err));
  }

  public async start() {
    if (this.server.listening) {
      return;
    }

    this.server.listen(getConfigOption("MANAGER_PORT"));
  }

  public stop() {
    return new Promise((resolve) => {
      this.server.once("close", () => resolve(null));

      this.server.close();
    });
  }

  public registerConnection(
    runnerId: string,
    action: ActionsTableType,
    version: JobVersionsTableType
  ) {
    this.connections.set(runnerId, {
      status: "pending",
      action,
      version,
      runnerId,
    });
  }

  public getConnectionStatus(runnerId: string) {
    const connection = this.connections.get(runnerId);

    return connection?.status ?? null;
  }

  public async awaitConnectionStatus(
    runnerId: string,
    status: RunnerServerItem["status"] = "ready"
  ) {
    return await awaitTruthy(async () => {
      return this.getConnectionStatus(runnerId) === status;
    }, 60_000);
  }

  public sendHandleRequest(
    runnerId: string,
    handleRequest: HandleRequest
  ): Promise<HandleResponse> {
    return new Promise((resolve, _reject) => {
      const traceId = createToken({
        length: 256,
        prefix: "HandleRequestTraceId",
      });

      const connection = this.connections.get(runnerId);

      if (!connection) {
        return resolve({
          success: false,
          duration: -1,
          error: "Jobber: Runner connection not found",
        });
      }

      if (connection.status !== "ready") {
        return resolve({
          success: false,
          duration: -1,
          error: "Jobber: Runner connection not ready",
        });
      }

      const timeoutInterval = setTimeout(() => {
        this.traceResponses.delete(traceId);

        return resolve({
          success: false,
          duration: -1,
          error: "Jobber: Timeout Error",
        });
      }, connection.action.runnerTimeout * 1000);

      this.traceResponses.set(traceId, (frame, data) => {
        clearTimeout(timeoutInterval);

        this.traceResponses.delete(traceId);

        if (typeof frame.dataType !== "string" || frame.dataType !== "json") {
          return resolve({
            success: false,
            duration: -1,
            error: `Jobber: Runner sent back "${frame.dataType}", expected "json"`,
          });
        }

        const handleResponse = JSON.parse(data.toString());

        if (typeof handleResponse.success !== "boolean") {
          console.warn(
            `[RunnerServer/sendHandleRequest] Malformed response object, handleResponse.success expected to be boolean`
          );

          return resolve({
            success: false,
            duration: -1,
            error: `Jobber: Malformed response object`,
          });
        }

        if (!handleResponse.success) {
          return resolve({
            success: false,
            error: handleResponse.error ?? "An unknown error occurred",
            duration: handleResponse.duration ?? -1,
          });
        }

        if (handleRequest.type === "http" && handleResponse.http) {
          const httpBody = Buffer.from(handleResponse.http.body, "base64");

          return resolve({
            success: true,
            duration: handleResponse.duration ?? -1,
            http: {
              body: httpBody,
              headers: handleResponse.http.headers,
              status: handleResponse.http.status,
            },
          });
        }

        if (handleRequest.type === "mqtt" && handleResponse.mqtt) {
          const publish: NonNullable<
            Extract<HandleResponse, { success: true }>["mqtt"]
          >["publish"] = [];

          if (handleResponse.mqtt?.publish) {
            for (const item of handleResponse.mqtt?.publish) {
              publish.push({
                topic: item.topic as string,
                body: Buffer.from(item.body, "base64"),
              });
            }
          }

          return resolve({
            success: true,
            duration: handleResponse.duration ?? -1,
            mqtt: {
              publish,
            },
          });
        }

        return resolve({
          success: true,
          duration: handleResponse.duration ?? -1,
        });
      });

      this.writeFrame(
        {
          name: "handle",
          traceId,
          runnerId,
          dataType: "json",
        },
        Buffer.from(JSON.stringify(handleRequest))
      );
    });
  }

  public async sendShutdownRequest(runnerId: string) {
    const connection = this.connections.get(runnerId);

    if (!connection || connection.status !== "ready") {
      return false;
    }

    const traceId = createToken({
      length: 128,
      prefix: "ShutdownRequestTraceId",
    });

    await this.writeFrame(
      {
        traceId,
        name: "shutdown",
        runnerId: runnerId,
        dataType: "buffer",
      },
      Buffer.alloc(0)
    );

    this.emit("runner-closing", runnerId);

    this.connections.set(runnerId, {
      ...connection,
      status: "closing",
    });

    return true;
  }

  private async onFrame(socket: TcpFrameSocket, buffer: Buffer) {
    const separator = buffer.indexOf("\n");

    if (separator <= 0) {
      console.warn(`[RunnerServer/onFrame] Received malformed frame!`);

      return;
    }

    const chunkJson = buffer.subarray(0, separator);
    const bodyBuffer = buffer.subarray(separator + 1);

    const frame = JSON.parse(chunkJson.toString("utf8")) as FrameJson;

    if (frame.name === "response") {
      const traceResponseCallback = this.traceResponses.get(frame.traceId);

      if (!traceResponseCallback) {
        return;
      }

      traceResponseCallback(frame, bodyBuffer);

      return;
    }

    if (frame.name === "init") {
      const connection = this.connections.get(frame.runnerId);

      if (!connection) {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", cannot find connection for runner ${shortenString(
            frame.runnerId
          )}!`
        );

        return;
      }

      if (connection.status !== "pending") {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", connection already initialised, with status of ${
            connection.status
          }, for runner ${shortenString(frame.runnerId)}!`
        );

        return;
      }

      this.connections.set(frame.runnerId, {
        ...connection,
        status: "starting",
        socket,
      });

      this.emit("runner-starting", frame.runnerId);

      socket.once("close", () => {
        this.emit("runner-close", frame.runnerId);
        this.connections.delete(frame.runnerId);
      });

      this.writeFrame(
        {
          name: "response",
          runnerId: frame.runnerId,
          traceId: frame.traceId,
          dataType: "buffer",
        },
        await readFile(
          getJobActionArchiveFile(connection.version, connection.action)
        )
      );

      return;
    }

    if (frame.name === "ready") {
      const connection = this.connections.get(frame.runnerId);

      if (!connection) {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", cannot find connection for runner ${shortenString(
            frame.runnerId
          )}!`
        );

        return;
      }

      if (connection.status !== "starting") {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", connection already initialised, with status of ${
            connection.status
          }, for runner ${shortenString(frame.runnerId)}!`
        );

        return;
      }

      this.connections.set(frame.runnerId, {
        ...connection,
        status: "ready",
        socket,
      });

      this.emit("runner-ready", frame.runnerId);

      return;
    }

    if (frame.name.startsWith("store")) {
      const connection = this.connections.get(frame.runnerId);

      if (!connection) {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", cannot find connection for runner ${shortenString(
            frame.runnerId
          )}!`
        );

        return;
      }

      if (connection.status === "pending") {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", connection has not started! runner ${shortenString(
            frame.runnerId
          )}!`
        );

        return;
      }

      if (frame.dataType !== "json") {
        console.warn(
          `[RunnerServer/onFrame] handle frame name "${
            frame.name
          }", received unexpected dataType! runner ${shortenString(
            frame.runnerId
          )}!`
        );

        return;
      }

      if (frame.name === "store-get") {
        const bodyParsed = JSON.parse(bodyBuffer.toString()) as { key: string };

        const item = await this.store.getItem(
          connection.action.jobId,
          bodyParsed.key
        );

        await this.writeFrame(
          {
            dataType: "json",
            name: "response",
            runnerId: frame.runnerId,
            traceId: frame.traceId,
          },
          Buffer.from(JSON.stringify(item))
        );

        return;
      }

      if (frame.name === "store-set") {
        const bodyParsed = JSON.parse(bodyBuffer.toString()) as {
          key: string;
          value: string;
          ttl?: number;
        };

        const item = await this.store.setItem(
          connection.action.jobId,
          bodyParsed.key,
          {
            value: bodyParsed.value,
            ttl: bodyParsed.ttl,
          }
        );

        await this.writeFrame(
          {
            dataType: "json",
            name: "response",
            runnerId: frame.runnerId,
            traceId: frame.traceId,
          },
          Buffer.from(JSON.stringify(item))
        );

        return;
      }

      if (frame.name === "store-delete") {
        const bodyParsed = JSON.parse(bodyBuffer.toString()) as {
          key: string;
        };

        const item = await this.store.deleteItem(
          connection.action.jobId,
          bodyParsed.key
        );

        await this.writeFrame(
          {
            dataType: "json",
            name: "response",
            runnerId: frame.runnerId,
            traceId: frame.traceId,
          },
          Buffer.from(JSON.stringify(item))
        );

        return;
      }
    }
  }

  private async writeFrame(frame: FrameJson, buffer: Buffer) {
    const connection = this.connections.get(frame.runnerId);

    if (!connection) {
      return false;
    }

    if (connection.status !== "ready" && connection.status !== "starting") {
      return false;
    }

    const data = Buffer.concat([
      Buffer.from(JSON.stringify(frame)),
      Buffer.from("\n"),
      buffer,
    ]);

    await connection.socket.writeFrame(data);

    return true;
  }
}
