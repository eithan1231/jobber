import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { randomBytes } from "crypto";
import { copyFile, mkdir, readdir, rm } from "fs/promises";
import path from "path";
import {
  getPathJobActionRunnerDirectory,
  getPathJobActionRunnersDirectory,
  getPathJobActionsArchiveFile,
} from "~/paths.js";
import {
  awaitTruthy,
  createToken,
  fileExists,
  getUnixTimestamp,
  presentablePath,
  sanitiseFilename,
  shortenString,
  timeout,
  unzip,
} from "~/util.js";
import { Actions } from "../actions.js";
import { Job } from "../job.js";
import {
  RunnerServer,
  SendHandleRequest,
  SendHandleResponse,
} from "./server.js";
import { StatusLifecycle } from "../types.js";

type RunnerItem = {
  status: "starting" | "started" | "closing" | "closed";
  id: string;
  jobName: string;
  actionId: string;
  actionVersion: string;

  /**
   * Used to determine if environment variables have changed since
   * starting running
   */
  environmentModifiedAt: number;

  directory: string;

  process: ChildProcessWithoutNullStreams;

  createdAt: number;
  startedAt?: number;
  closingAt?: number;
  closedAt?: number;
};

/**
 * Manages the lifecycle of runners, from beginning of their process to end.
 * - Starts runners
 * - Scales runners up and down
 */
export class Runners {
  private runnerServer: RunnerServer;

  private runners = new Map<string, RunnerItem>();

  private runnersCurrentLoad: Record<string, number> = {};

  private runnersIndexActionId: Record<string, string[]> = {};

  private requestedStartActionId = new Set<string>();

  private job: Job;

  private actions: Actions;

  private status: StatusLifecycle = "neutral";

  private isLoopRunning = false;

  constructor(job: Job, actions: Actions) {
    this.runnerServer = new RunnerServer();

    this.job = job;
    this.actions = actions;

    this.runnerServer.on("runner-open", (runnerId: string) => {
      const runner = this.runners.get(runnerId);

      if (!runner) {
        console.warn(
          `[Runners/runnerServer.runner-open] Runner not found ${shortenString(
            runnerId
          )}`
        );

        return;
      }

      this.runners.set(runnerId, {
        ...runner,
        status: "started",
        startedAt: getUnixTimestamp(),
      });
    });

    this.runnerServer.on("runner-closing", (runnerId: string) => {
      const runner = this.runners.get(runnerId);

      if (!runner) {
        console.warn(
          `[Runners/runnerServer.runner-closing] Runner not found ${shortenString(
            runnerId
          )}`
        );

        return;
      }

      this.runners.set(runnerId, {
        ...runner,
        status: "closing",
        closingAt: getUnixTimestamp(),
      });
    });

    this.runnerServer.on("runner-close", (runnerId: string) => {
      const runner = this.runners.get(runnerId);

      if (!runner) {
        console.warn(
          `[Runners/runnerServer.runner-close] Runner not found ${shortenString(
            runnerId
          )}`
        );

        return;
      }

      this.runners.set(runnerId, {
        ...runner,
        status: "closed",
        closedAt: getUnixTimestamp(),
      });

      runner.process.kill("SIGKILL");
    });
  }

  public async start() {
    if (
      this.status === "starting" ||
      this.status === "started" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Runners/start] Cannot start with status of ${this.status}`
      );
    }

    this.status = "starting";

    const actions = this.actions.getActions();
    for (const action of actions) {
      const actionRunnersDir = getPathJobActionRunnersDirectory(
        action.jobName,
        action.id
      );

      if (!(await fileExists(actionRunnersDir))) {
        continue;
      }

      const folders = await readdir(actionRunnersDir);

      for (const folderName of folders) {
        const folderPath = path.join(actionRunnersDir, folderName);

        console.log(
          `[Runners/start] Removing unexpected runner directory ${presentablePath(
            folderPath
          )}`
        );

        await rm(actionRunnersDir, { recursive: true });
      }
    }

    await this.runnerServer.start();

    this.loop();

    this.status = "started";
  }

  public async stop() {
    if (
      this.status === "neutral" ||
      this.status === "starting" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Runners/start] Cannot stop with status of ${this.status}`
      );
    }

    this.status = "stopping";

    console.log("[Runners/stop] stopping runners");

    await this.runnerServer.stop();

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";

    console.log("[Runners/stop] runners stopped");
  }

  private async createRunner(actionId: string) {
    const action = this.actions.getAction(actionId);

    const id = createToken({
      length: 128,
      prefix: "runner",
    });

    const archiveFile = getPathJobActionsArchiveFile(action.jobName, action.id);

    const runtimeDirectory = getPathJobActionRunnerDirectory(
      action.jobName,
      action.id,
      id
    );

    await mkdir(runtimeDirectory, { recursive: true });

    await unzip(archiveFile, runtimeDirectory);

    const entrypoint = path.join(
      runtimeDirectory,
      `entrypoint-${randomBytes(6).toString("hex")}.js`
    );

    await copyFile("./src/jobber/child-wrapper/entrypoint.js", entrypoint);

    this.runnerServer.registerConnection(id);

    const environment = this.job.getEnvironment(action.jobName);

    const env: Record<string, string> = {};
    for (const [name, value] of Object.entries(environment.config)) {
      env[name] = value.value;
    }

    const child = spawn(
      "node",
      [
        entrypoint,
        "--job-runner-identifier",
        id,
        "--job-controller-host",
        RunnerServer.HOSTNAME,
        "--job-controller-port",
        RunnerServer.PORT.toString(),
      ],
      {
        env: {
          ...env,
          PATH: process.env.PATH,
        },
        windowsHide: true,
        cwd: runtimeDirectory,
        stdio: "pipe",
      }
    );

    child.once("spawn", () => {
      console.log(
        `[Runners/createRunner] event "spawn" for runnerId ${shortenString(id)}`
      );
    });

    child.once("exit", () => {
      console.log(
        `[Runners/createRunner] event "exit" for runnerId ${shortenString(id)}`
      );

      this.removeRunner(id);

      rm(runtimeDirectory, { recursive: true });
    });

    child.stderr.on("data", (chunk: Buffer) =>
      this.job.addLog(action.jobName, {
        runnerId: id,
        actionId: action.id,
        jobName: action.jobName,
        jobVersion: action.version,
        source: "STDERR",
        timestamp: getUnixTimestamp(),
        message: chunk.toString(),
      })
    );

    child.stdout.on("data", (chunk) =>
      this.job.addLog(action.jobName, {
        runnerId: id,
        actionId: action.id,
        jobName: action.jobName,
        jobVersion: action.version,
        source: "STDOUT",
        timestamp: getUnixTimestamp(),
        message: chunk.toString(),
      })
    );

    this.addRunner({
      status: "starting",
      createdAt: getUnixTimestamp(),
      id: id,
      actionId: action.id,
      actionVersion: action.version,
      directory: runtimeDirectory,
      jobName: action.jobName,
      process: child,
      environmentModifiedAt: environment.modifiedAt,
    });

    return id;
  }

  private async deleteRunner(runnerId: string) {
    console.log(
      `[Runners/deleteRunner] Deleting runner ${shortenString(runnerId)}`
    );

    const runner = this.runners.get(runnerId);

    assert(runner);

    if (runner.status === "starting") {
      console.log(
        `[Runners/deleteRunner] Awaiting for runner to start before closing... ${shortenString(
          runnerId
        )}`
      );

      if (
        !(await this.runnerServer.awaitConnectionStatus(runner.id, "connected"))
      ) {
        throw new Error(
          `[Runners/deleteRunner] Failed to wait for runner to connect during deletion`
        );
      }
    }

    if (runner.status === "started") {
      console.log(
        `[Runners/deleteRunner] Sending shutdown to runner ${shortenString(
          runnerId
        )}`
      );

      await this.runnerServer.sendShutdownRequest(runnerId);
    }

    console.log(
      `[Runners/deleteRunner] Awaiting for runner to be removed... ${shortenString(
        runnerId
      )}`
    );

    await awaitTruthy(async () => {
      return !this.runners.has(runnerId);
    });

    console.log(
      `[Runners/deleteRunner] Runner deleted ${shortenString(runnerId)}`
    );
  }

  public async deleteRunnersByActionId(actionId: string) {
    const runners = this.getRunnersByActionId(actionId);

    await Promise.all(runners.map((runner) => this.deleteRunner(runner.id)));
  }

  public async sendHandleRequest(
    actionId: string,
    payload: SendHandleRequest
  ): Promise<SendHandleResponse> {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const action = this.actions.getAction(actionId);

    const actionRunners = this.getRunnersByActionId(actionId);

    const activeRunnersCount = actionRunners.length;

    const canCreateRunner =
      action.runnerMaxCount === 0 || activeRunnersCount < action.runnerMaxCount;

    if (action.runnerMode === "run-once") {
      if (!canCreateRunner) {
        console.warn(
          `[Runners/sendHandleRequest] Failed to start runner, allocation of runners exhausted. activeRunners ${activeRunnersCount}`
        );

        return {
          success: false,
          duration: 0,
          error:
            "Robber: Failed to start runner, allocation of runners exhausted.",
        };
      }

      const runnerId = await this.createRunner(actionId);

      await this.runnerServer.awaitConnectionStatus(runnerId, "connected");

      const runner = this.runners.get(runnerId);

      if (!runner) {
        throw new Error(`[Runners/sendHandleRequest] Unable to find runner.`);
      }

      if (runner.status !== "started") {
        console.warn(
          `[Runners/sendHandleRequest] Failed to start runner, sending termination. status ${runner.status}`
        );

        runner.process.kill("SIGTERM");

        return {
          success: false,
          duration: 0,
          error: "Robber: Runner failed to start.",
        };
      }

      let result: SendHandleResponse;

      try {
        this.runnersCurrentLoad[runnerId]++;

        result = await this.runnerServer.sendHandleRequest(runnerId, payload);
      } finally {
        this.runnersCurrentLoad[runnerId]--;

        await this.runnerServer.sendShutdownRequest(runnerId);
      }

      return result;
    }

    if (action.runnerMode === "standard") {
      const validRunners = actionRunners
        .filter((index) => {
          if (index.status !== "started") {
            return false;
          }

          if (
            !action.runnerAsynchronous &&
            this.runnersCurrentLoad[index.id] > 0
          ) {
            return false;
          }

          return true;
        })
        .sort(
          (a, b) =>
            this.runnersCurrentLoad[a.id] - this.runnersCurrentLoad[b.id]
        );

      if (validRunners.length <= 0) {
        this.requestedStartActionId.add(action.id);

        await awaitTruthy(async () => {
          const runners = this.getRunnersByActionId(action.id);

          return (
            runners.length > 0 &&
            runners.some(
              (index) =>
                index.actionId === action.id && index.status === "started"
            )
          );
        });

        const runners = this.getRunnersByActionId(action.id);

        const runner = runners.find(
          (index) => index.actionId === action.id && index.status === "started"
        );

        if (!runner) {
          throw new Error("Failed to start runner!");
        }

        validRunners.push(runner);
      }

      const runner = validRunners[0];

      if (runner.status === "starting") {
        await this.runnerServer.awaitConnectionStatus(runner.id, "connected");
      }

      if (runner.status !== "started") {
        console.warn(
          `[Runners/sendHandleRequest] Failed to find valid runner. status ${runner.status}`
        );

        return {
          success: false,
          duration: 0,
          error: "Robber: Failed to find valid runner.",
        };
      }

      let result: SendHandleResponse;

      try {
        this.runnersCurrentLoad[runner.id]++;

        result = await this.runnerServer.sendHandleRequest(runner.id, payload);
      } finally {
        this.runnersCurrentLoad[runner.id]--;
      }

      return result;
    }

    throw new Error(`[Runners/sendHandleRequest] Unexpected runner mode.`);
  }

  public getRunnersByActionId(actionId: string) {
    const result: RunnerItem[] = [];

    if (!this.runnersIndexActionId[actionId]) {
      return result;
    }

    for (const id of this.runnersIndexActionId[actionId]) {
      const item = this.runners.get(id);

      assert(item);

      result.push(item);
    }

    return result;
  }

  private addRunner(payload: RunnerItem) {
    this.runners.set(payload.id, payload);

    if (this.runnersIndexActionId[payload.actionId]) {
      this.runnersIndexActionId[payload.actionId].push(payload.id);
    } else {
      this.runnersIndexActionId[payload.actionId] = [payload.id];
    }

    this.runnersCurrentLoad[payload.id] = 0;
  }

  private removeRunner(runnerId: string) {
    const runner = this.runners.get(runnerId);

    assert(runner);

    this.runners.delete(runnerId);

    assert(this.runnersIndexActionId[runner.actionId]);

    const index = this.runnersIndexActionId[runner.actionId].indexOf(runnerId);

    assert(index >= 0);

    const removedIds = this.runnersIndexActionId[runner.actionId].splice(
      index,
      1
    );

    assert(removedIds.length === 1);
    assert(removedIds[0] === runnerId);

    if (this.runnersIndexActionId[runner.actionId].length === 0) {
      delete this.runnersIndexActionId[runner.actionId];
    }

    delete this.runnersCurrentLoad[runnerId];
  }

  private async loop() {
    console.log(
      `[Runners/loopIntegrity] Integrity loop has started ${this.status}`
    );
    this.isLoopRunning = true;

    while (this.status === "started" || this.status === "starting") {
      const jobNames = this.job.getJobs().map((job) => job.name);

      await Promise.all(
        jobNames.map((jobName) => this.loopCheckJobName(jobName))
      );

      await timeout(250);
    }

    await Promise.all(
      this.job.getJobs().map((job) => this.loopCheckJobNameClose(job.name))
    );

    console.log(
      `[Runners/loopIntegrity] Integrity loop has exited ${this.status}`
    );
    this.isLoopRunning = false;
  }

  private async loopCheckJobNameClose(jobName: string) {
    for (const [_runnerId, runner] of this.runners.entries()) {
      if (runner.status === "started" || runner.status === "starting") {
        runner.process.kill("SIGTERM");
      }
    }
  }

  private async loopCheckJobName(jobName: string) {
    const job = this.job.getJob(jobName);

    if (!job) {
      return;
    }

    const actions = this.actions.getActionsByJobName(jobName);

    const actionCurrent = actions.find(
      (index) => index.version === job.version
    );

    const actionsOutdated = actions.filter(
      (index) => index.version !== job.version
    );

    const runnersCurrent = actions
      .map((index) => this.getRunnersByActionId(index.id))
      .flat();

    const runnersOutdated = actionsOutdated
      .map((index) => this.getRunnersByActionId(index.id))
      .flat();

    // Logging
    if (runnersOutdated.length > 0) {
      const runningVersions: string[] = [];
      for (const runner of runnersOutdated) {
        if (!runningVersions.includes(runner.actionVersion)) {
          runningVersions.push(runner.actionVersion);
        }
      }

      console.log(
        `[Runners/integrityCheckJobName] ${jobName} has ${
          runnersOutdated.length
        } runners, on outdated versions ${runningVersions.join(
          ", "
        )}, target version is ${job.version}`
      );
    }

    // Check if we need to spawn new runners
    if (
      this.status === "started" &&
      actionCurrent &&
      actionCurrent.runnerMode === "standard"
    ) {
      const runnerLoadAverage = runnersCurrent.reduce(
        (prev, runner) => (this.runnersCurrentLoad[runner.id] + prev) / 2,
        0
      );

      const targetLoadPerRunner = actionCurrent.runnerAsynchronous ? 10 : 1;

      let targetRunnerCount = Math.ceil(
        (runnerLoadAverage / targetLoadPerRunner) * 1.2
      );

      if (Number.isNaN(targetRunnerCount)) {
        targetRunnerCount = 0;
      }

      if (this.requestedStartActionId.has(actionCurrent.id)) {
        this.requestedStartActionId.delete(actionCurrent.id);

        if (targetRunnerCount <= 0) {
          targetRunnerCount++;
        }
      }

      if (targetRunnerCount > actionCurrent.runnerMaxCount) {
        targetRunnerCount = actionCurrent.runnerMaxCount;
      }

      if (targetRunnerCount < actionCurrent.runnerMinCount) {
        targetRunnerCount = actionCurrent.runnerMinCount;
      }

      const spawnCount = targetRunnerCount - runnersCurrent.length;

      if (spawnCount > 0) {
        console.log(
          `[Runners/integrityCheckJobName] Load on action ${shortenString(
            actionCurrent.id
          )} summons more runners. Starting ${spawnCount} more runners. Action average load per runner ${targetLoadPerRunner}`
        );

        for (let i = 0; i < spawnCount; i++) {
          const runnerId = await this.createRunner(actionCurrent.id);

          await this.runnerServer.awaitConnectionStatus(runnerId, "connected");
        }
      }
    }

    // Closing outdated runners
    if (runnersOutdated.length > 0) {
      for (const runner of runnersOutdated) {
        if (runner.status === "started") {
          console.log(
            `[Runners/integrityCheckJobName] Sending graceful shutdown to outdated runner. version ${
              runner.actionVersion
            }, runnerId ${shortenString(runner.id)}!`
          );

          await this.runnerServer.sendShutdownRequest(runner.id);
        }
      }
    }

    // Close runners with outdated environment variables.
    if (
      this.status === "started" &&
      actionCurrent &&
      actionCurrent.runnerMode === "standard"
    ) {
      const environment = this.job.getEnvironment(actionCurrent.jobName);

      for (const runner of runnersCurrent) {
        if (runner.environmentModifiedAt !== environment.modifiedAt) {
          console.log(
            `[Runners/integrityCheckJobName] Sending graceful shutdown to runner, environment change detected ${shortenString(
              runner.id
            )}`
          );

          await this.runnerServer.sendShutdownRequest(runner.id);
        }
      }
    }

    // Check max age of runners
    if (
      actionCurrent &&
      actionCurrent.runnerMode === "standard" &&
      actionCurrent.runnerMaxAge
    ) {
      for (const runner of runnersCurrent) {
        if (runner.status === "started") {
          const duration = getUnixTimestamp() - (runner.startedAt ?? 0);

          if (duration > actionCurrent.runnerMaxAge) {
            console.log(
              `[Runners/integrityCheckJobName] Sending graceful shutdown to runner ${shortenString(
                runner.id
              )}`
            );

            await this.runnerServer.sendShutdownRequest(runner.id);
          }
        }
      }
    }

    // Check hard max age of runners
    if (
      actionCurrent &&
      actionCurrent.runnerMode === "standard" &&
      actionCurrent.runnerMaxAgeHard
    ) {
      for (const runner of runnersCurrent) {
        if (runner.status === "started") {
          const duration = getUnixTimestamp() - (runner.startedAt ?? 0);

          if (duration > actionCurrent.runnerMaxAgeHard) {
            console.log(
              `[Runners/integrityCheckJobName] Sending SIGTERM shutdown to runner ${shortenString(
                runner.id
              )}!`
            );

            runner.process.kill("SIGTERM");
          }
        }
      }
    }
  }
}
