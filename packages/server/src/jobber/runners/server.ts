import assert, { strictEqual } from "assert";
import { Server } from "net";
import { awaitTruthy, createToken } from "../../util.js";
import { TcpFrameSocket } from "@jobber/tcp-frame-socket";
import { EventEmitter } from "events";
import { readFile } from "fs/promises";
import { getConfigOption } from "~/config.js";

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
      init: {
        archiveFile: string;
      };
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
  private server: Server;

  private connections = new Map<string, ConnectionDetails>();

  private socketTraceIdResponses = new Map<
    string,
    (traceId: string, data: any) => void
  >();

  constructor() {
    super();

    this.server = new Server({
      noDelay: true,
    });

    this.server.on("connection", (socket) => {
      const runnerSocket = new TcpFrameSocket(socket);
      runnerSocket.on("frame", (buffer) => {
        this.onFrame(runnerSocket, buffer);
      });
    });

    this.server.on("error", (err) => {
      console.error(err);
    });

    this.server.once("listening", () => {
      console.log(
        `[RunnerServer/listen] Listening on port ${getConfigOption(
          "MANAGER_PORT"
        )}`
      );
    });
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
    init: Extract<ConnectionDetails, { status: "pending" }>["init"]
  ) {
    this.connections.set(runnerId, {
      status: "pending",
      runnerId,
      init,
    });
  }

  public getConnectionStatus(runnerId: string) {
    const connection = this.connections.get(runnerId);

    assert(connection);

    return connection.status;
  }

  public async awaitConnectionStatus(
    runnerId: string,
    status: ConnectionDetails["status"] = "ready"
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
      strictEqual(connection.status, "ready");

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

      this.writeFrame(
        {
          runnerId: connection.runnerId,
          traceId,
          name: "handle",
          dataType: "json",
        },
        Buffer.from(JSON.stringify(payload))
      ).then(() => {
        clearTimeout(timeoutInterval);
      });
    });
  }

  public async sendShutdownRequest(runnerId: string) {
    const connection = this.connections.get(runnerId);

    assert(connection);
    strictEqual(connection.status, "ready");

    const traceId = createToken({
      length: 128,
      prefix: "traceId-shutdown",
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
      runnerId,
      status: "closing",
      socket: connection.socket,
    });
  }

  private async writeFrame(frame: FrameJson, data: Buffer) {
    const connection = this.connections.get(frame.runnerId);

    assert(connection);
    assert(connection.status === "ready" || connection.status == "starting");

    const buffer = Buffer.concat([
      Buffer.from(JSON.stringify(frame)),
      Buffer.from("\n"),
      data,
    ]);

    await connection.socket.writeFrame(buffer);
  }

  private async onFrame(socket: TcpFrameSocket, buffer: Buffer) {
    const separator = buffer.indexOf("\n");

    assert(separator > 0);

    const chunkJson = buffer.subarray(0, separator);
    const bodyBuffer = buffer.subarray(separator + 1);

    const { name, runnerId, traceId, dataType } = JSON.parse(
      chunkJson.toString("utf8")
    ) as FrameJson;

    if (name === "handle-response") {
      if (dataType !== "json") {
        throw new Error("expected dataType of json");
      }

      const bodyJson = JSON.parse(bodyBuffer.toString("utf8"));

      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(["ready", "disconnecting"].includes(connection.status));

      const traceCallback = this.socketTraceIdResponses.get(traceId);

      assert(traceCallback);

      traceCallback(traceId, bodyJson);
    }

    if (name === "init") {
      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(connection.status === "pending");

      this.connections.set(runnerId, {
        status: "starting",
        socket,
        runnerId,
      });

      this.emit("runner-starting", runnerId);

      socket.once("close", () => {
        this.emit("runner-close", runnerId);
        this.connections.delete(runnerId);
      });

      const archiveContent = await readFile(connection.init.archiveFile);

      this.writeFrame(
        {
          name: "init-response",
          runnerId,
          traceId,
          dataType: "buffer",
        },
        archiveContent
      );
    }

    if (name === "ready") {
      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(connection.status === "starting");

      this.connections.set(runnerId, {
        status: "ready",
        socket,
        runnerId,
      });

      this.emit("runner-ready", runnerId);
    }
  }
}
