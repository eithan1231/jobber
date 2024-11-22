import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { randomBytes } from "crypto";
import { Server, Socket } from "net";
import { awaitTruthy, getUnixTimestamp } from "./util.js";
import path from "path";

type DTOResponseInit = {
  type: "init";
};

type DTOResponseHandle = {
  type: "handle-response";
  payload: unknown;
};

type DTOResponse = (DTOResponseInit | DTOResponseHandle) & {
  id: string;
  traceId?: string;
};
type DTORequestHandle<RequestPayload> = {
  type: "handle";

  traceId: string;
  metadata: {
    //
  };
  payload: RequestPayload;
};

type DTORequestShutdown = {
  type: "shutdown";
};

// Stores record of all known actions
type JobControllerAction = {
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
type JobControllerActionRunnerPending = {
  status: "pending";
};

type JobControllerActionRunnerConnected = {
  status: "connected";
  socket: Socket;
};

type JobControllerActionRunnerDisconnecting = {
  status: "disconnecting";
  disconnectionStartTime: number;
  socket: Socket;
};

type JobControllerActionRunnerDisconnected = {
  status: "disconnected";
};

type JobControllerActionRunner = (
  | JobControllerActionRunnerPending
  | JobControllerActionRunnerConnected
  | JobControllerActionRunnerDisconnecting
  | JobControllerActionRunnerDisconnected
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

  private actions: Map<string, JobControllerAction> = new Map();

  private actionRunners: Map<string, JobControllerActionRunner> = new Map();

  private eventRunnerTickInterval: NodeJS.Timeout | null = null;

  private socketTraceIdResponses: Map<
    string,
    (data: DTOResponseHandle) => void
  > = new Map();

  constructor() {
    this.server = new Server();
  }

  private async sendActionRunnerShutdown(runnerId: string) {
    const actionRunner = this.actionRunners.get(runnerId);

    if (!actionRunner || actionRunner.status !== "connected") {
      throw new Error(`Failed to send shutdown commend to runner ${runnerId}`);
    }

    this.actionRunners.set(runnerId, {
      ...actionRunner,
      disconnectionStartTime: getUnixTimestamp(),
      status: "disconnecting",
    });

    const payload: DTORequestShutdown = {
      type: "shutdown",
    };

    actionRunner.socket.write(JSON.stringify(payload));
  }

  private findActionRunnersByActionId(actionId: string) {
    const result: JobControllerActionRunner[] = [];

    for (const [_, actionRunner] of this.actionRunners.entries()) {
      if (actionRunner.actionId === actionId) {
        result.push(actionRunner);
      }
    }

    return result;
  }

  private createActionRunnerByActionId(actionId: string) {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Action not found ${actionId}`);
    }

    const id = randomBytes(64).toString("hex");

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

      this.actionRunners.delete(id);
    });

    this.actionRunners.set(id, {
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
  private async getActionRunnerByActionId(actionId: string) {
    const action = this.actions.get(actionId);

    if (!action) {
      throw new Error(`Failed to get action by id ${actionId}`);
    }

    if (action.keepAlive) {
      const actionRunners = this.findActionRunnersByActionId(actionId);

      for (const actionRunner of actionRunners) {
        if (actionRunner.status === "connected") {
          return actionRunner;
        }
      }
    }

    const runnerId = this.createActionRunnerByActionId(actionId);

    await awaitTruthy(async () => {
      const actionRunner = this.actionRunners.get(runnerId);

      if (!actionRunner) {
        return false;
      }

      if (actionRunner.status !== "connected") {
        return false;
      }

      return true;
    });

    return this.actionRunners.get(runnerId);
  }

  /**
   * Sends handle command to runner, and awaits response.
   */
  public sendHandleRequest<RequestPayload, ResponsePayload>(
    actionId: string,
    request: RequestPayload
  ): Promise<ResponsePayload> {
    return new Promise(async (resolve, reject) => {
      const traceId = `traceId-${randomBytes(64).toString("hex")}`;

      const action = this.actions.get(actionId);

      if (!action) {
        return reject(new Error(`Failed to find action ${actionId}`));
      }

      const runner = await this.getActionRunnerByActionId(actionId);

      if (!runner) {
        return reject(new Error(`Failed to get runner`));
      }

      if (runner.status !== "connected") {
        return reject(
          new Error(
            `Failed to get runner, expected status connected, received ${runner.status}`
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

        reject(new Error("Timeout error"));
      }, 60_000);

      this.socketTraceIdResponses.set(traceId, (data: DTOResponseHandle) => {
        clearTimeout(timeoutInterval);

        this.socketTraceIdResponses.delete(traceId);

        resolve(data.payload as ResponsePayload);

        // TODO: Find a more nice solution for this. We are managing its lifecycle in two places.
        if (!action.keepAlive) {
          this.sendActionRunnerShutdown(runner.id);
        }
      });

      runner.socket.write(JSON.stringify(payload));
    });
  }

  /**
   * Registers a known action
   */
  public async registerAction(payload: JobControllerAction) {
    this.actions.set(payload.id, payload);
  }

  /**
   * Handles bringing up new runners
   * Handles bringing down old runners.
   * Validates integrity of runners.
   */
  private async eventRunnerTick() {
    // Check if no socket opened on process after a minute
    for (const [runnerId, runner] of this.actionRunners) {
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
      const actionRunners = this.findActionRunnersByActionId(action.id);

      // CREATE KEEPALIVE APPLICATION
      if (action.keepAlive && actionRunners.length <= 0) {
        this.createActionRunnerByActionId(actionId);
      }

      for (const actionRunner of actionRunners) {
        // KEEP ALIVE REFRESH
        if (
          action.keepAlive &&
          actionRunner.status === "connected" &&
          getUnixTimestamp() - actionRunner.created > action.refreshTimeout
        ) {
          await this.sendActionRunnerShutdown(actionRunner.id);
        }

        // DISCONNECTING TIMEOUT, FORCEFUL CLOSE
        const disconnectKillAfter = 60 * 20; // 20 minutes
        for (const actionRunner of actionRunners) {
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
      const runner = this.actionRunners.get(data.id);

      if (!runner) {
        socket.end();

        throw new Error("Failed to find runner while initialising client.");
      }

      if (runner.status === "connected") {
        throw new Error(
          "Cannot initialise already connected runner. Session Hijacking attempt?"
        );
      }

      this.actionRunners.set(data.id, {
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
      const runner = this.actionRunners.get(data.id);

      if (!runner || runner.status !== "connected") {
        throw new Error("Unable to find runner with associated data.");
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
    console.log(`[JobController/onSocketClose] Started, runnerId ${runnerId}`);

    const runner = this.actionRunners.get(runnerId);

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
