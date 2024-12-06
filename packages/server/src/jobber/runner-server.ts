import assert from "assert";
import { Server, Socket } from "net";
import { awaitTruthy, createToken, getUnixTimestamp } from "../util.js";

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
      socket: Socket;
    }
);

export type RunnerServeCloseEvent = (runnerId: string) => void;
export type RunnerServeClosingEvent = (runnerId: string) => void;
export type RunnerServeOpenEvent = (runnerId: string) => void;

export class RunnerServer {
  public static readonly PORT = 5211;
  public static readonly HOSTNAME = "127.0.0.1";

  private server: Server;

  private connections = new Map<string, ConnectionDetails>();

  private transactionChunks: TransactionChunks = {};

  private socketTraceIdResponses: Map<
    string,
    (traceId: string, data: any) => void
  > = new Map();

  private onCloseEvent: null | RunnerServeCloseEvent = null;

  private onClosingEvent: null | RunnerServeClosingEvent = null;

  private onOpenEvent: null | RunnerServeOpenEvent = null;

  constructor() {
    this.server = new Server({
      noDelay: true,
    });
  }

  public async start() {
    if (this.server.listening) {
      return;
    }

    this.server.on("connection", (socket) => {
      socket.on("data", (data: Buffer) => {
        this.onData(socket, data);
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

  public registerCloseEvent(handler: RunnerServeCloseEvent) {
    this.onCloseEvent = handler;
  }

  public registerClosingEvent(handler: RunnerServeClosingEvent) {
    this.onClosingEvent = handler;
  }

  public registerOpenEvent(handler: RunnerServeOpenEvent) {
    this.onOpenEvent = handler;
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
      assert(connection.status === "connected");

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

        assert(typeof data.success === "boolean");

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

      this.writeJson(connection.runnerId, "handle", traceId, payload).catch(
        (err) => {
          clearTimeout(timeoutInterval);

          reject(err);
        }
      );
    });
  }

  public async sendShutdownRequest(runnerId: string) {
    const traceId = createToken({
      length: 128,
      prefix: "traceId-shutdown",
    });

    if (this.onClosingEvent) {
      this.onClosingEvent(runnerId);
    }

    await this.writeJson(runnerId, "shutdown", traceId, {});
  }

  public async writeJson(
    runnerId: string,
    name: string,
    traceId: string,
    data: any
  ) {
    const buffer = Buffer.from(JSON.stringify(data));

    if (buffer.length <= 1000) {
      await this.write(
        runnerId,
        name,
        traceId,
        ["is-start", "is-end", "is-encoding-json"],
        buffer
      );

      return;
    }

    for (let i = 0; i < buffer.length; i += 1000) {
      const extras: PacketExtras[] = ["is-encoding-json"];

      if (i === 0) {
        extras.push("is-start");
      }

      if (i + 1000 >= buffer.length) {
        extras.push("is-end");
      }

      await this.write(
        runnerId,
        name,
        traceId,
        extras,
        buffer.subarray(i, i + 1000)
      );
    }
  }

  private write(
    runnerId: string,
    name: string,
    traceId: string,
    extras: PacketExtras[],
    data: Buffer
  ) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(runnerId);

      assert(connection);
      assert(connection.status === "connected");

      const firstLine = stringifyFirstLine(name, traceId, extras);

      const buffer = Buffer.concat([Buffer.from(`${firstLine}\n`), data]);

      connection.socket.write(buffer, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve(null);
      });
    });
  }

  private async onData(socket: Socket, data: Buffer) {
    let firstLineIndex = data.indexOf("\n");

    if (firstLineIndex < 0) {
      throw new Error("Failed to parse first line!");
    }

    const firstLine = data.subarray(0, firstLineIndex).toString("utf8");

    const metadata = parseFirstLine(firstLine);

    const dataChunk = data.subarray(firstLineIndex + 1);

    if (metadata.isStart && metadata.isEnd) {
      this.onTransaction(
        socket,
        metadata.name,
        metadata.runnerId,
        metadata.traceId,
        metadata.encoding,
        [dataChunk]
      );

      return;
    }

    if (metadata.isStart) {
      this.transactionChunks[metadata.traceId] = {
        name: metadata.name,
        traceId: metadata.traceId,
        runnerId: metadata.runnerId,
        encoding: metadata.encoding,
        createdAt: getUnixTimestamp(),
        modifiedAt: getUnixTimestamp(),
        chunks: [dataChunk],
      };

      return;
    }

    if (metadata.isEnd) {
      this.transactionChunks[metadata.traceId].chunks.push(dataChunk);

      this.onTransaction(
        socket,
        this.transactionChunks[metadata.traceId].name,
        this.transactionChunks[metadata.traceId].runnerId,
        this.transactionChunks[metadata.traceId].traceId,
        this.transactionChunks[metadata.traceId].encoding,
        this.transactionChunks[metadata.traceId].chunks
      );

      delete this.transactionChunks[metadata.traceId];

      return;
    }

    this.transactionChunks[metadata.traceId].chunks.push(dataChunk);
  }

  private async onTransaction(
    socket: Socket,
    name: string,
    runnerId: string,
    traceId: string,
    encoding: PacketFirstLine["encoding"],
    data: Array<Buffer>
  ) {
    const buffer = Buffer.concat(data);

    if (name === "handle-response") {
      if (encoding !== "json") {
        throw new Error(`Expected encoding to be json, got ${encoding}`);
      }

      this.onTransaction_HandleResponse(
        socket,
        runnerId,
        traceId,
        JSON.parse(buffer.toString())
      );

      return;
    }

    if (name === "init") {
      if (encoding !== "json") {
        throw new Error(`Expected encoding to be json, got ${encoding}`);
      }

      this.onTransaction_Init(
        socket,
        runnerId,
        traceId,
        JSON.parse(buffer.toString())
      );

      return;
    }
  }

  private async onTransaction_HandleResponse(
    socket: Socket,
    runnerId: string,
    traceId: string,
    data: {}
  ) {
    const connection = this.connections.get(runnerId);

    assert(connection);
    assert(["connected", "disconnecting"].includes(connection.status));

    const traceCallback = this.socketTraceIdResponses.get(traceId);

    assert(traceCallback);

    traceCallback(traceId, data);
  }

  private async onTransaction_Init(
    socket: Socket,
    runnerId: string,
    traceId: string,
    data: { id: string }
  ) {
    const connection = this.connections.get(runnerId);

    assert(connection);
    assert(connection.status === "pending");

    this.connections.set(runnerId, {
      ...connection,
      status: "connected",
      socket: socket,
    });

    if (this.onOpenEvent) {
      this.onOpenEvent(runnerId);
    }

    socket.once("close", () => {
      // create event.
      if (this.onCloseEvent) {
        this.onCloseEvent(runnerId);
      }

      this.connections.delete(runnerId);
    });
  }
}

type PacketExtras =
  | "is-start"
  | "is-end"
  | "is-encoding-json"
  | "is-encoding-binary";

type PacketFirstLine = {
  name: string;
  runnerId: string;
  traceId: string;
  encoding: "json" | "binary" | "unknown";
  isStart: boolean;
  isEnd: boolean;
};

type TransactionChunks = {
  [traceId: string]: {
    name: string;
    runnerId: string;
    traceId: string;
    encoding: PacketFirstLine["encoding"];
    createdAt: number;
    modifiedAt: number;
    chunks: Array<Buffer>;
  };
};

const parseFirstLine = (line: string): PacketFirstLine => {
  const split = line.trimEnd().split("::");
  let encoding: PacketFirstLine["encoding"] = "unknown";

  if (split.includes("is-encoding-json", 3)) {
    encoding = "json";
  }

  if (split.includes("is-encoding-binary", 3)) {
    encoding = "binary";
  }

  const isStart = split.includes("is-start", 3);
  const isEnd = split.includes("is-end", 3);

  const name = split.at(0);
  if (!name) {
    throw new Error("Name not present");
  }

  const runnerId = split.at(1);
  if (!runnerId) {
    throw new Error("runnerId not present");
  }

  const traceId = split.at(2);
  if (!traceId) {
    throw new Error("traceId not present");
  }

  return {
    name,
    runnerId,
    traceId,
    encoding,
    isStart,
    isEnd,
  };
};

const stringifyFirstLine = (
  name: string,
  traceId: string,
  extras: PacketExtras[]
) => {
  return [name, traceId, ...extras].join("::");
};
