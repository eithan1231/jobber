import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { randomBytes } from "crypto";
import { Server, Socket } from "net";
import path from "path";
import { awaitTruthy, getUnixTimestamp } from "../util.js";
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

export type SendHandleRequest = { type: "schedule" } | SendHandleRequestHttp;

export type SendHandleResponse = (
  | {
      success: true;
      http?: {
        status: number;
        headers: Record<string, string>;
        body: Buffer;
      };
    }
  | { success: false; error: string }
) & {
  duration: number;
};

// Stores record of all known actions
type Action = {
  status: "active" | "closing";
  id: string;
  jobName: string;

  environment: Record<string, string>;

  /**
   * Should child process be on standby all the time?
   */
  keepAlive: boolean;

  /**
   * If child processes should be kept alive, for how long until they are reloaded
   */
  refreshTimeout: number;

  runtime: {
    directory: string;
    entrypoint: string;
  };
};

type RunnerPending = {
  status: "pending";
};

type RunnerConnected = {
  status: "connected";
  socket: Socket;
};

type RunnerDisconnecting = {
  status: "disconnecting";
  disconnectionStartTime: number;
  socket: Socket;
};

type RunnerDisconnected = {
  status: "disconnected";
};

type Runner = (
  | RunnerPending
  | RunnerConnected
  | RunnerDisconnecting
  | RunnerDisconnected
) & {
  id: string;
  actionId: string;
  jobName: string;
  created: number;
  process: ChildProcessWithoutNullStreams;
};

const SERVER_TCP_PORT = 5211;

export class JobController {
  private server: Server;

  private actions: Map<string, Action> = new Map();

  private runners: Map<string, Runner> = new Map();

  private eventRunnerTickInterval: NodeJS.Timeout | null = null;

  private transactionChunks: TransactionChunks = {};

  private socketTraceIdResponses: Map<
    string,
    (raceId: string, data: any) => void
  > = new Map();

  constructor() {
    this.server = new Server();
  }

  private async sendRunnerShutdown(runnerId: string) {
    const runner = this.runners.get(runnerId);

    if (!runner || runner.status !== "connected") {
      throw new Error(`Failed to send shutdown commend to runner ${runnerId}`);
    }

    await this.writeJson(
      runner.id,
      "shutdown",
      randomBytes(32).toString("hex"),
      {}
    );

    this.runners.set(runnerId, {
      ...runner,
      disconnectionStartTime: getUnixTimestamp(),
      status: "disconnecting",
    });
  }

  private findRunnersByActionId(actionId: string) {
    const result: Runner[] = [];

    for (const [_, runner] of this.runners.entries()) {
      if (runner.actionId === actionId) {
        result.push(runner);
      }
    }

    return result;
  }

  private createRunnerByActionId(actionId: string) {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Action not found ${actionId}`);
    }

    const id = `runner-${randomBytes(24).toString("hex")}`;

    const proc = spawn(
      "node",
      [
        path.join(action.runtime.directory, action.runtime.entrypoint),
        "--job-runner-identifier",
        id,
        "--job-controller-host",
        "127.0.0.1",
        "--job-controller-port",
        SERVER_TCP_PORT.toString(),
      ],
      {
        env: {
          ...action.environment,
          PATH: process.env.PATH,
        },
        windowsHide: true,
        cwd: action.runtime.directory,
        stdio: "pipe",
      }
    );

    proc.once("spawn", () => {
      console.log(
        `[JobController/createActionRunnerByActionId] event "spawn" for runnerId ${id}`
      );
    });

    proc.once("exit", () => {
      console.log(
        `[JobController/createActionRunnerByActionId] event "exit" for runnerId ${id}`
      );

      this.runners.delete(id);
    });

    if (getConfigOption("DEBUG_RUNNER_STD")) {
      proc.stderr.on("data", (chunk) =>
        console.log(`${id.substring(10)}...: ${chunk.toString().trim()}`)
      );

      proc.stdout.on("data", (chunk) =>
        console.log(`${id.substring(10)}...: ${chunk.toString().trim()}`)
      );
    }

    this.runners.set(id, {
      status: "pending",
      id: id,
      actionId: actionId,
      jobName: action.jobName,
      created: getUnixTimestamp(),
      process: proc,
    });

    return id;
  }

  /**
   * Gets or creates a new runner
   */
  private async getRunnerByActionId(actionId: string) {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Failed to get action by id ${actionId}`);
    }

    if (action.keepAlive) {
      const actionRunners = this.findRunnersByActionId(actionId);

      for (const actionRunner of actionRunners) {
        if (actionRunner.status === "connected") {
          return actionRunner;
        }
      }
    }

    const runnerId = this.createRunnerByActionId(actionId);

    await awaitTruthy(async () => {
      const actionRunner = this.runners.get(runnerId);

      if (!actionRunner) {
        return false;
      }

      if (actionRunner.status !== "connected") {
        return false;
      }

      return true;
    });

    return this.runners.get(runnerId);
  }

  /**
   * Sends handle command to runner, and awaits response.
   */
  public sendHandleRequest(
    actionId: string,
    payload: SendHandleRequest
  ): Promise<SendHandleResponse> {
    return new Promise(async (resolve, reject) => {
      const traceId = `traceId-${randomBytes(64).toString("hex")}`;

      const action = this.actions.get(actionId);

      if (!action) {
        return reject(
          new Error(
            `[JobController/sendHandleRequest] Failed to find action ${actionId}`
          )
        );
      }

      if (action.status !== "active") {
        return reject(
          new Error(
            `[JobController/sendHandleRequest] Action invoked with status of "${action.status}", expected "active"`
          )
        );
      }

      const runner = await this.getRunnerByActionId(actionId);

      if (!runner) {
        return reject(
          new Error(`[JobController/sendHandleRequest] Failed to get runner`)
        );
      }

      if (runner.status !== "connected") {
        return reject(
          new Error(
            `[JobController/sendHandleRequest] Failed to get runner, expected status connected, received ${runner.status}`
          )
        );
      }

      const timeoutInterval = setTimeout(() => {
        this.socketTraceIdResponses.delete(traceId);

        reject(new Error("[JobController/sendHandleRequest] Timeout error"));
      }, 60_000);

      this.socketTraceIdResponses.set(traceId, (traceId, data) => {
        clearTimeout(timeoutInterval);

        this.socketTraceIdResponses.delete(traceId);

        // TODO: Find a more nice solution for this. We are managing its lifecycle in two places.
        if (!action.keepAlive) {
          this.sendRunnerShutdown(runner.id);
        }

        if (typeof data.success === "undefined") {
          return reject(
            new Error("[JobController/sendHandleRequest] Unknown status")
          );
        }

        if (!data.success) {
          return resolve({
            success: false,
            error: data.error ?? "An unknown error occurred",
            duration: data.duration ?? -1,
          });
        }

        if (data.http) {
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

        return resolve({
          success: true,
          duration: data.duration ?? -1,
        });
      });

      this.writeJson(runner.id, "handle", traceId, payload).catch((err) => {
        clearTimeout(timeoutInterval);

        reject(err);
      });
    });
  }

  /**
   * Registers a known action
   */
  public async registerAction(payload: Omit<Action, "status">) {
    this.actions.set(payload.id, {
      ...payload,
      status: "active",
    });
  }

  public async deregisterAction(actionId: string) {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error("Failed to get action");
    }

    this.actions.set(actionId, {
      ...action,
      status: "closing",
    });

    if (action.keepAlive) {
      for (const [, runner] of this.runners) {
        if (runner.actionId === actionId && runner.status === "connected") {
          await this.sendRunnerShutdown(runner.id);
        }
      }
    }

    const success = await awaitTruthy(async () => {
      for (const [, runner] of this.runners.entries()) {
        if (runner.actionId === actionId) {
          return false;
        }
      }

      return true;
    }, 60_000 * 5);

    if (!success) {
      throw new Error("[deregisterAction] Failed to deregister action");
    }
  }

  /**
   * Handles bringing up new runners
   * Handles bringing down old runners.
   * Validates integrity of runners.
   */
  private async eventRunnerTick() {
    // Check if no socket opened on process after a minute
    for (const [runnerId, runner] of this.runners) {
      if (
        getUnixTimestamp() - runner.created > 60 &&
        runner.status == "pending"
      ) {
        console.log(
          `[JobController/eventRunnerTick] Runner started 60 seconds ago, without initiating connection with job controller. Terminating process.  runnerId ${runnerId}`
        );

        runner.process.kill("SIGTERM");
      }
    }

    for (const [actionId, action] of this.actions) {
      const runners = this.findRunnersByActionId(action.id);

      // CREATE KEEPALIVE APPLICATION
      if (
        action.status === "active" &&
        action.keepAlive &&
        runners.length <= 0
      ) {
        this.createRunnerByActionId(actionId);
      }

      for (const runner of runners) {
        // KEEP ALIVE REFRESH
        if (
          action.keepAlive &&
          runner.status === "connected" &&
          getUnixTimestamp() - runner.created > action.refreshTimeout
        ) {
          await this.sendRunnerShutdown(runner.id);
        }

        // DISCONNECTING TIMEOUT, FORCEFUL CLOSE
        const disconnectKillAfter = 60 * 20; // 20 minutes
        for (const actionRunner of runners) {
          if (
            actionRunner.status === "disconnecting" &&
            getUnixTimestamp() - actionRunner.disconnectionStartTime >
              disconnectKillAfter
          ) {
            console.log(
              `[JobController/eventRunnerTick] disconnecting status for ${disconnectKillAfter} seconds, sending force kill`
            );

            actionRunner.process.kill("SIGTERM");
          }
        }
      }
    }
  }

  async writeJson(runnerId: string, name: string, traceId: string, data: any) {
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
      const runner = this.runners.get(runnerId);

      if (!runner) {
        return reject(new Error("Unable to find runner"));
      }

      if (runner.status !== "connected") {
        return reject(new Error("Cannot write when runner is not connected"));
      }

      const firstLine = stringifyFirstLine(name, traceId, extras);

      const buffer = Buffer.concat([Buffer.from(`${firstLine}\n`), data]);

      runner.socket.write(buffer, (err) => {
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
    const runner = this.runners.get(runnerId);

    if (!runner) {
      throw new Error("Unable to find runner with associated data.");
    }

    const expectedStatuses = ["connected", "disconnecting"];
    if (!expectedStatuses.includes(runner.status)) {
      throw new Error(
        `Unable to find valid runner. Expected status of ${expectedStatuses.join(
          ", "
        )}, but got ${runner.status}`
      );
    }

    const traceCallback = this.socketTraceIdResponses.get(traceId);
    if (!traceCallback) {
      console.log(
        `[JobController/onSocketData] Failed to find trace callback. traceId ${traceId}`
      );

      return;
    }

    traceCallback(traceId, data);
  }

  private async onTransaction_Init(
    socket: Socket,
    runnerId: string,
    traceId: string,
    data: { id: string }
  ) {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      socket.end();

      throw new Error("Failed to find runner while initialising client.");
    }

    if (runner.status === "connected") {
      throw new Error(
        "Cannot initialise already connected runner. Session Hijacking attempt?"
      );
    }

    this.runners.set(runnerId, {
      ...runner,

      status: "connected",
      socket: socket,
    });

    socket.once("close", () => {
      this.onTransaction_Init_Close(socket, runner.id);
    });
  }

  private async onTransaction_Init_Close(socket: Socket, runnerId: string) {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      console.log(
        `[JobController/onTransaction_Init_Close] Runner not found, runnerId ${runnerId}`
      );

      return;
    }

    console.log(
      `[JobController/onTransaction_Init_Close] Sending SIGKILL, runnerId ${runnerId}`
    );

    runner.process.kill("SIGKILL");
  }

  /**
   * Starts the TCP server that manages all clients.
   */
  public async listen() {
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
        `[JobController/listen] Listening on port ${SERVER_TCP_PORT}`
      );
    });

    this.server.listen(SERVER_TCP_PORT, "127.0.0.1");

    this.eventRunnerTickInterval = setInterval(
      () => this.eventRunnerTick(),
      1000
    );
  }

  public async close() {
    this.server.close();

    if (this.eventRunnerTickInterval) {
      clearInterval(this.eventRunnerTickInterval);
    }
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
