import assert, { strictEqual } from "assert";
import { Server, Socket } from "net";
import { awaitTruthy, createToken } from "../../util.js";
import { RunnerSocket } from "./socket.js";
import { EventEmitter } from "events";

export type SendHandleRequestHttp = {
  type: "http";
  headers: Record<string, string>;
  query: Record<string, string>;
  queries: Record<string, string[]>;
  path: string;
  method: string;
  body: string;
  bodyLength: number;
};

export type SendHandleRequestMqtt = {
  type: "mqtt";
  topic: string;
  body: string;
  bodyLength: number;
};

export type SendHandleRequest =
  | { type: "schedule" }
  | SendHandleRequestHttp
  | SendHandleRequestMqtt;

export type SendHandleResponse = (
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

type ConnectionDetails = {
  runnerId: string;
} & (
  | {
      status: "pending";
    }
  | {
      status: "connected" | "disconnecting";
      socket: RunnerSocket;
    }
);

type Frame<T = unknown> = {
  runnerId: string;
  name: string;
  traceId: string;
  data: T;
};

export class RunnerServer extends EventEmitter<{
  "runner-close": [runnerId: string];
  "runner-closing": [runnerId: string];
  "runner-open": [runnerId: string];
}> {
  public static readonly PORT = 5211;
  public static readonly HOSTNAME = "127.0.0.1";

  private server: Server;

  private connections = new Map<string, ConnectionDetails>();

  private socketTraceIdResponses: Map<
    string,
    (traceId: string, data: any) => void
  > = new Map();
  constructor() {
    super();

    this.server = new Server({
      noDelay: true,
    });

    this.server.on("connection", (socket) => {
      const runnerSocket = new RunnerSocket(socket);
      runnerSocket.on("frame", (buffer) => {
        this.onFrame(runnerSocket, buffer);
      });
    });

    this.server.on("error", (err) => {
      console.error(err);
    });

    this.server.once("listening", () => {
      console.log(
        `[RunnerServer/listen] Listening on port ${RunnerServer.PORT}`
      );
    });
  }

  public async start() {
    if (this.server.listening) {
      return;
    }

    this.server.listen(RunnerServer.PORT, RunnerServer.HOSTNAME);
  }

  public stop() {
    return new Promise((resolve) => {
      this.server.once("close", () => resolve(null));

      this.server.close();
    });
  }

  public registerConnection(runnerId: string) {
    this.connections.set(runnerId, {
      status: "pending",
      runnerId,
    });
  }

  public getConnectionStatus(runnerId: string) {
    const connection = this.connections.get(runnerId);

    assert(connection);

    return connection.status;
  }

  public async awaitConnectionStatus(
    runnerId: string,
    status: ConnectionDetails["status"] = "connected"
  ) {
    return await awaitTruthy(async () => {
      return this.getConnectionStatus(runnerId) === status;
    }, 60_000);
  }

  public sendHandleRequest(
    runnerId: string,
    payload: SendHandleRequest
  ): Promise<SendHandleResponse> {
    return new Promise(async (resolve, reject) => {
      const traceId = createToken({
        length: 128,
        prefix: "traceId-handle",
      });

      const connection = this.connections.get(runnerId);

      assert(connection);
      strictEqual(connection.status, "connected");

      const timeoutInterval = setTimeout(() => {
        this.socketTraceIdResponses.delete(traceId);

        resolve({
          success: false,
          duration: -1,
          error: "Jobber: Timeout Error",
        });
      }, 60_000);

      this.socketTraceIdResponses.set(traceId, (traceId, data) => {
        clearTimeout(timeoutInterval);

        this.socketTraceIdResponses.delete(traceId);

        strictEqual(typeof data.success, "boolean");

        if (!data.success) {
          return resolve({
            success: false,
            error: data.error ?? "An unknown error occurred",
            duration: data.duration ?? -1,
          });
        }

        if (payload.type === "http" && data.http) {
          const httpBody = Buffer.from(data.http.body, "base64");

          return resolve({
            success: true,
            duration: data.duration ?? -1,
            http: {
              body: httpBody,
              headers: data.http.headers,
              status: data.http.status,
            },
          });
        }

        if (payload.type === "mqtt" && data.mqtt) {
          const publish: NonNullable<
            Extract<SendHandleResponse, { success: true }>["mqtt"]
          >["publish"] = [];

          if (data.mqtt?.publish) {
            for (const item of data.mqtt?.publish) {
              publish.push({
                topic: item.topic as string,
                body: Buffer.from(item.body, "base64"),
              });
            }
          }

          return resolve({
            success: true,
            duration: data.duration ?? -1,
            mqtt: {
              publish,
            },
          });
        }

        return resolve({
          success: true,
          duration: data.duration ?? -1,
        });
      });

      this.writeFrame({
        runnerId: connection.runnerId,
        traceId,
        name: "handle",
        data: payload,
      }).then(() => {
        clearTimeout(timeoutInterval);
      });
    });
  }

  public async sendShutdownRequest(runnerId: string) {
    const connection = this.connections.get(runnerId);

    assert(connection);
    strictEqual(connection.status, "connected");

    const traceId = createToken({
      length: 128,
      prefix: "traceId-shutdown",
    });

    await this.writeFrame({
      traceId,
      name: "shutdown",
      runnerId: runnerId,
      data: {},
    });

    this.emit("runner-closing", runnerId);

    this.connections.set(runnerId, {
      runnerId,
      status: "disconnecting",
      socket: connection.socket,
    });
  }

  private async writeFrame<T = unknown>(frame: Frame<T>) {
    const connection = this.connections.get(frame.runnerId);

    assert(connection);
    strictEqual(connection.status, "connected");

    const buffer = Buffer.from(JSON.stringify(frame));

    await connection.socket.writeFrame(buffer);
  }

  private onFrame(socket: RunnerSocket, buffer: Buffer) {
    const { name, runnerId, traceId, data } = JSON.parse(
      buffer.toString("utf8")
    ) as Frame;

    if (name === "handle-response") {
      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(["connected", "disconnecting"].includes(connection.status));

      const traceCallback = this.socketTraceIdResponses.get(traceId);

      assert(traceCallback);

      traceCallback(traceId, data);
    }

    if (name === "init") {
      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(connection.status === "pending");

      this.connections.set(runnerId, {
        status: "connected",
        socket,
        runnerId,
      });

      this.emit("runner-open", runnerId);

      socket.once("close", () => {
        this.emit("runner-close", runnerId);
        this.connections.delete(runnerId);
      });
    }
  }
}
