import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { randomBytes } from "crypto";
import { Server, Socket } from "net";
import path from "path";
import { awaitTruthy, getUnixTimestamp } from "../util.js";
import { getConfigOption } from "~/config.js";

/////////////////////////////////// DTO Responses (From client)

type DTOResponseInit = {
  type: "init";
};

type DTOResponseHandle = {
  type: "handle-response";
  metadata: {
    duration?: number;
    success?: boolean;
    error?: string;
  };
  payload: unknown;
};

type DTOResponse = (DTOResponseInit | DTOResponseHandle) & {
  id: string;
  traceId?: string;
};

/////////////////////////////////// DTO Requests (From server)

type DTORequestHandle<RequestPayload> = {
  type: "handle";

  traceId: string;
  metadata: {};
  payload: RequestPayload;
};

type DTORequestShutdown = {
  type: "shutdown";
};

// Stores record of all known actions
type JobControllerAction = {
  status: "active" | "closing";
  id: string;
  jobName: string;

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
// Stores record of currently running runners
type JobControllerRunnerPending = {
  status: "pending";
};

type JobControllerRunnerConnected = {
  status: "connected";
  socket: Socket;
};

type JobControllerRunnerDisconnecting = {
  status: "disconnecting";
  disconnectionStartTime: number;
  socket: Socket;
};

type JobControllerRunnerDisconnected = {
  status: "disconnected";
};

type JobControllerRunner = (
  | JobControllerRunnerPending
  | JobControllerRunnerConnected
  | JobControllerRunnerDisconnecting
  | JobControllerRunnerDisconnected
) & {
  id: string;
  actionId: string;
  jobName: string;
  created: number;
  process: ChildProcessWithoutNullStreams;
};

export type HandlerResult<T> = (
  | { success: true; payload: T }
  | { success: false; error: string }
) & {
  duration: number;
};

const SERVER_TCP_PORT = 5211;

export class JobController {
  private server: Server;

  private actions: Map<string, JobControllerAction> = new Map();

  private runners: Map<string, JobControllerRunner> = new Map();

  private eventRunnerTickInterval: NodeJS.Timeout | null = null;

  private socketTraceIdResponses: Map<
    string,
    (data: DTOResponseHandle) => void
  > = new Map();

  constructor() {
    this.server = new Server();
  }

  private async sendRunnerShutdown(runnerId: string) {
    const runner = this.runners.get(runnerId);

    if (!runner || runner.status !== "connected") {
      throw new Error(`Failed to send shutdown commend to runner ${runnerId}`);
    }

    this.runners.set(runnerId, {
      ...runner,
      disconnectionStartTime: getUnixTimestamp(),
      status: "disconnecting",
    });

    const payload: DTORequestShutdown = {
      type: "shutdown",
    };

    runner.socket.write(JSON.stringify(payload));
  }

  private findRunnersByActionId(actionId: string) {
    const result: JobControllerRunner[] = [];

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
        windowsHide: true,
        cwd: action.runtime.directory,
        stdio: "pipe",
      }
    );

    proc.once("spawn", () => {
      console.log(
        `[createActionRunnerByActionId] event "spawn" for runnerId ${id}`
      );
    });

    proc.once("exit", () => {
      console.log(
        `[createActionRunnerByActionId] event "exit" for runnerId ${id}`
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
  public sendHandleRequest<RequestPayload, ResponsePayload>(
    actionId: string,
    request: RequestPayload
  ): Promise<HandlerResult<ResponsePayload>> {
    return new Promise(async (resolve, reject) => {
      const traceId = `traceId-${randomBytes(64).toString("hex")}`;

      const action = this.actions.get(actionId);

      if (!action) {
        return reject(
          new Error(`[sendHandleRequest] Failed to find action ${actionId}`)
        );
      }

      if (action.status !== "active") {
        return reject(
          new Error(
            `[sendHandleRequest] Action invoked with status of "${action.status}", expected "active"`
          )
        );
      }

      const runner = await this.getRunnerByActionId(actionId);

      if (!runner) {
        return reject(new Error(`[sendHandleRequest] Failed to get runner`));
      }

      if (runner.status !== "connected") {
        return reject(
          new Error(
            `[sendHandleRequest] Failed to get runner, expected status connected, received ${runner.status}`
          )
        );
      }

      const payload: DTORequestHandle<RequestPayload> = {
        type: "handle",
        traceId: traceId,
        payload: request,
        metadata: {},
      };

      const timeoutInterval = setTimeout(() => {
        this.socketTraceIdResponses.delete(traceId);

        reject(new Error("[sendHandleRequest] Timeout error"));
      }, 60_000);

      this.socketTraceIdResponses.set(traceId, (data: DTOResponseHandle) => {
        clearTimeout(timeoutInterval);

        this.socketTraceIdResponses.delete(traceId);

        // TODO: Find a more nice solution for this. We are managing its lifecycle in two places.
        if (!action.keepAlive) {
          this.sendRunnerShutdown(runner.id);
        }

        if (typeof data.metadata.success === "undefined") {
          return reject(
            new Error("[sendHandleRequest] Unknown metadata status")
          );
        }

        if (!data.metadata.success) {
          return resolve({
            success: false,
            error: data.metadata.error ?? "An unknown error occurred",
            duration: data.metadata.duration ?? -1,
          });
        }

        return resolve({
          success: true,
          payload: data.payload as ResponsePayload,
          duration: data.metadata.duration ?? -1,
        });
      });

      runner.socket.write(JSON.stringify(payload), (err) => {
        if (err) {
          clearTimeout(timeoutInterval);

          reject(err);
        }
      });
    });
  }

  /**
   * Registers a known action
   */
  public async registerAction(payload: Omit<JobControllerAction, "status">) {
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

  /**
   * Event for handling socket data
   */
  private onSocketData(socket: Socket, data: DTOResponse) {
    if (data.type === "init") {
      const runner = this.runners.get(data.id);

      if (!runner) {
        socket.end();

        throw new Error("Failed to find runner while initialising client.");
      }

      if (runner.status === "connected") {
        throw new Error(
          "Cannot initialise already connected runner. Session Hijacking attempt?"
        );
      }

      this.runners.set(data.id, {
        ...runner,

        status: "connected",
        socket: socket,
      });

      socket.once("close", () => {
        if (runner) {
          this.onSocketClose(socket, data.id);
        }
      });

      return;
    }

    if (data.type === "handle-response") {
      const runner = this.runners.get(data.id);

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

      if (!data.traceId) {
        throw new Error(
          "Expecting traceId to be present on handle-response event"
        );
      }

      const traceCallback = this.socketTraceIdResponses.get(data.traceId);
      if (!traceCallback) {
        console.log(
          `[JobController/onSocketData] Failed to find trace callback. traceId ${data.traceId}`
        );

        return;
      }

      traceCallback(data);

      return;
    }

    console.log(
      `[JobController/listen] Received unknown type from runner. Payload ${data}`
    );
  }

  private onSocketClose(socket: Socket, runnerId: string) {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      console.log(
        `[JobController/onSocketClose] Runner not found, runnerId ${runnerId}`
      );

      return;
    }

    console.log(
      `[JobController/onSocketClose] Sending SIGKILL, runnerId ${runnerId}`
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
        this.onSocketData(socket, JSON.parse(data.toString()));
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
