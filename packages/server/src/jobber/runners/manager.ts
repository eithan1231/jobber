import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { and, eq, isNotNull } from "drizzle-orm";
import { getConfigOption } from "~/config.js";
import { ENTRYPOINT_NODE } from "~/constants.js";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import {
  environmentsTable,
  EnvironmentsTableType,
} from "~/db/schema/environments.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { getDockerContainers, stopDockerContainer } from "~/docker.js";
import {
  awaitTruthy,
  createBenchmark,
  createToken,
  getUnixTimestamp,
  sanitiseSafeCharacters,
  shortenString,
  timeout,
} from "~/util.js";
import { getImage } from "../images.js";
import { LogDriverBase } from "../log-drivers/abstract.js";
import { StatusLifecycle } from "../types.js";
import { HandleRequest, HandleResponse, RunnerServer } from "./server.js";
import { Store } from "../store.js";

type RunnerManagerItem = {
  status: "starting" | "ready" | "closing" | "closed";

  id: string;
  action: ActionsTableType;
  environment: EnvironmentsTableType | null;

  process: ChildProcessWithoutNullStreams;

  requestsProcessing: number;

  createdAt: number;
  readyAt?: number;
  closingAt?: number;
  closedAt?: number;
};

export class RunnerManager {
  private logger: LogDriverBase;

  private store: Store;

  private server: RunnerServer;

  private runners: Record<string, RunnerManagerItem> = {};

  private requestedActionIds = new Set<string>();

  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

  constructor(store: Store, logger: LogDriverBase) {
    this.logger = logger;

    this.store = store;

    this.server = new RunnerServer(this.store);

    this.server.on("runner-starting", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        return;
      }

      runner.status = "starting";
    });

    this.server.on("runner-ready", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        return;
      }

      runner.status = "ready";
    });

    this.server.on("runner-closing", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        return;
      }

      runner.status = "closing";
    });

    this.server.on("runner-close", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        return;
      }

      runner.status = "closed";
      runner.process.kill("SIGKILL");
    });
  }

  public async start() {
    assert(this.status === "neutral");

    this.status = "starting";

    this.loop();

    await awaitTruthy(() => Promise.resolve(this.isLoopRunning));

    await this.server.start();

    this.status = "started";
  }

  public async stop() {
    assert(this.status === "started");

    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    await this.server.stop();

    this.status = "neutral";
  }

  public async sendHandleRequest(
    action: ActionsTableType,
    handleRequest: HandleRequest
  ): Promise<HandleResponse> {
    const actionRunners = Object.values(this.runners).filter(
      (index) => index.action.id === action.id
    );

    if (action.runnerMode === "run-once") {
      const canCreateRunner =
        action.runnerMaxCount === 0 ||
        actionRunners.length < action.runnerMaxCount;

      if (!canCreateRunner) {
        console.warn(
          `[RunnerManager/sendHandleRequest] Failed to start runner, allocation of runners exhausted. actionRunners.length ${actionRunners.length}`
        );

        return {
          success: false,
          duration: -1,
          error: "Jobber: Failed to start runner.",
        };
      }

      const runnerId = await this.createRunner(action, {
        dockerNamePrefix: "unknown",
      });

      await this.server.awaitConnectionStatus(runnerId, "ready");

      const runner = this.runners[runnerId];

      if (!runner) {
        console.warn(
          `[RunnerManager/sendHandleRequest] Failed to start runner, unable to find started runner`
        );

        return {
          success: false,
          duration: -1,
          error: "Jobber: Failed to start runner.",
        };
      }

      if (runner.status !== "ready") {
        console.warn(
          `[Runners/sendHandleRequest] Failed to start runner, sending termination. status ${runner.status}`
        );

        runner.process.kill("SIGTERM");

        return {
          success: false,
          duration: 0,
          error: "Jobber: Failed to start runner.",
        };
      }

      let result: HandleResponse;

      try {
        runner.requestsProcessing++;

        result = await this.server.sendHandleRequest(runner.id, handleRequest);

        await timeout(100);
      } finally {
        runner.requestsProcessing--;

        await this.server.sendShutdownRequest(runner.id);
      }

      return result;
    }

    if (action.runnerMode === "standard") {
      const actionRunnersPool = actionRunners
        .filter((index) => index.status === "ready")
        .sort((a, b) => a.requestsProcessing - b.requestsProcessing);

      // Start new runner
      if (actionRunnersPool.length <= 0) {
        this.requestedActionIds.add(action.id);

        await awaitTruthy(async () =>
          Object.values(this.runners).some(
            (index) => index.action.id === action.id && index.status === "ready"
          )
        );

        const runners = Object.values(this.runners).filter(
          (index) => index.action.id === action.id && index.status === "ready"
        );

        if (runners.length <= 0) {
          console.warn(
            `[RunnerManager/sendHandleRequest Failed to start runner, refer to other logs for more details.`
          );

          return {
            success: false,
            duration: -1,
            error: "Jobber: Runner failed to start!",
          };
        }

        actionRunnersPool.push(...runners);
      }

      const runner = actionRunnersPool.at(0);

      if (!runner || runner.status !== "ready") {
        console.warn(
          `[RunnerManager/sendHandleRequest] Cannot find runner for actionId ${action.id}`
        );

        return {
          success: false,
          error: "Jobber: Cannot find runner!",
          duration: -1,
        };
      }

      let result: HandleResponse;

      try {
        runner.requestsProcessing++;

        result = await this.server.sendHandleRequest(runner.id, handleRequest);
      } finally {
        runner.requestsProcessing--;
      }

      return result;
    }

    throw new Error(
      `[RunnerManager/sendHandleRequest] Unexpected runner mode.`
    );
  }

  public async findRunnersByJobId(jobId: string) {
    return Object.values(this.runners)
      .filter((index) => index.action.jobId === jobId)
      .map((index) => ({
        status: index.status,
        jobId: index.action.jobId,
        actionId: index.action.id,
        id: index.id,
        requestsProcessing: index.requestsProcessing,
        createdAt: index.createdAt,
        readyAt: index.readyAt,
        closingAt: index.closingAt,
        closedAt: index.closedAt,
      }));
  }

  public async findRunnersByActionId(actionId: string) {
    return Object.values(this.runners)
      .filter((index) => index.action.id === actionId)
      .map((index) => ({
        status: index.status,
        jobId: index.action.jobId,
        actionId: index.action.id,
        id: index.id,
        requestsProcessing: index.requestsProcessing,
        createdAt: index.createdAt,
        readyAt: index.readyAt,
        closingAt: index.closingAt,
        closedAt: index.closedAt,
      }));
  }

  private async createRunner(
    action: ActionsTableType,
    options?: {
      dockerNamePrefix?: string;
    }
  ) {
    console.log(
      `[RunnerManager/createRunner] Creating runner from action  ${shortenString(
        action.id
      )}`
    );

    const prefix = sanitiseSafeCharacters(
      `JobberRunner-${options?.dockerNamePrefix?.substring(0, 16)}`
    ).substring(0, 32);

    const id = createToken({
      length: 32,
      prefix,
    });

    this.server.registerConnection(id, action);

    const image = await getImage(action.runnerImage);

    if (!image) {
      throw new Error(
        `[RunnerManager/createRunner] Failed to find the image associated with action. actionId ${shortenString(
          action.id
        )}, actionRunnerImage ${action.runnerImage}`
      );
    }

    if (image.status === "disabled") {
      throw new Error(
        `[RunnerManager/createRunner] Action is using a disabled image! Unable to start runner. actionId ${shortenString(
          action.id
        )}, actionRunnerImage ${action.runnerImage}`
      );
    }

    if (image.status === "deprecated") {
      console.log(
        `[RunnerManager/createRunner] Action is using a deprecated image! actionId ${shortenString(
          action.id
        )}, actionRunnerImage ${action.runnerImage}`
      );
    }

    const environment =
      (
        await getDrizzle()
          .select()
          .from(environmentsTable)
          .where(eq(environmentsTable.jobId, action.jobId))
          .limit(1)
      ).at(0) ?? null;

    const args: string[] = [];

    args.push("run", "--rm", "--name", id);

    // TODO: This will be problematic if multiple Jobbers are running on a single
    // server. We should set this to a ID which is unique to this jobber
    // installation
    args.push("--label", "jobber=true");

    const dockerNetwork = getConfigOption("RUNNER_CONTAINER_DOCKER_NETWORK");
    if (dockerNetwork) {
      args.push("--network", dockerNetwork);
    }

    if (environment) {
      for (const [name, { value }] of Object.entries(environment.context)) {
        args.push("--env", `${name}=${value}`);
      }
    }

    args.push(
      image.imageUrl,
      "node",
      ENTRYPOINT_NODE,
      "--job-runner-identifier",
      id,
      "--job-controller-host",
      getConfigOption("MANAGER_HOST"),
      "--job-controller-port",
      getConfigOption("MANAGER_PORT").toString()
    );

    const process = spawn("docker", args, {
      windowsHide: true,
      stdio: "pipe",
    });

    process.once("exit", () => {
      delete this.runners[id];
    });

    process.stderr.on("data", (buffer: Buffer) => {
      const chunks = buffer.toString().split("\n");
      for (const chunk of chunks) {
        this.logger.write({
          actionId: action.id,
          jobId: action.jobId,
          created: getUnixTimestamp(),
          source: "runner",
          message: chunk.toString(),
        });
      }
    });

    process.stdout.on("data", (buffer: Buffer) => {
      const chunks = buffer.toString().split("\n");
      for (const chunk of chunks) {
        this.logger.write({
          actionId: action.id,
          jobId: action.jobId,
          created: getUnixTimestamp(),
          source: "runner",
          message: chunk.toString(),
        });
      }
    });

    this.runners[id] = {
      action,
      createdAt: getUnixTimestamp(),
      environment,
      id,
      process,
      requestsProcessing: 0,
      status: "starting",
    };

    return id;
  }

  private async loop() {
    this.isLoopRunning = true;

    let danglingLastRun = 0;

    while (this.status === "starting" || this.status === "started") {
      const benchmark = createBenchmark();

      const currentActions = await getDrizzle()
        .select({
          action: actionsTable,
          job: jobsTable,
          environment: environmentsTable,
        })
        .from(actionsTable)
        .innerJoin(
          jobsTable,
          and(
            eq(actionsTable.jobId, jobsTable.id),
            eq(actionsTable.version, jobsTable.version)
          )
        )
        .leftJoin(environmentsTable, eq(environmentsTable.jobId, jobsTable.id))
        .where(isNotNull(jobsTable.version));

      await this.loopRunnerSpawner(currentActions);
      await this.loopCheckEnvironmentChanges(currentActions);
      await this.loopCheckVersion(currentActions);
      await this.loopCheckMaxAge(currentActions);
      await this.loopCheckHardMaxAge(currentActions);

      if (getUnixTimestamp() - danglingLastRun > 60) {
        await this.loopCheckDanglingContainers(currentActions);

        danglingLastRun = getUnixTimestamp();
      }

      const benchmarkResult = benchmark();
      if (benchmarkResult >= 10_000) {
        console.log(
          `[RunnerManager/loop] loop iteration exceeded 10,000ms (10s), took ${benchmarkResult.toFixed(
            2
          )}ms to complete!`
        );
      }

      await timeout(500);
    }

    await this.loopClose();

    this.isLoopRunning = false;
  }

  private async loopClose() {
    // Graceful shutdown
    await Promise.all(
      Object.values(this.runners).map((runner) =>
        this.server.sendShutdownRequest(runner.id)
      )
    );

    if (
      await awaitTruthy(async () => {
        return Object.values(this.runners).length === 0;
      }, 60_000)
    ) {
      return;
    }

    // Forceful shutdown any lingering runners
    for (const runner of Object.values(this.runners)) {
      runner.process.kill("SIGTERM");
    }

    if (
      await awaitTruthy(async () => {
        return Object.values(this.runners).length === 0;
      }, 60_000)
    ) {
      return;
    }
  }

  private async loopCheckDanglingContainers(
    currentActions: { action: ActionsTableType; job: JobsTableType }[]
  ) {
    const containers = await getDockerContainers();

    for (const container of containers) {
      const labels = container.Labels.split(",").map((label) =>
        label.split("=", 2)
      );

      const isJobberRunner = labels.some(
        ([labelName, labelValue]) =>
          labelName === "jobber" && labelValue.toLowerCase() === "true"
      );

      if (!isJobberRunner) {
        continue;
      }

      const hasRunner = !!this.runners[container.Names];
      if (hasRunner) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckDockerContainers] Found dangling container! This should NOT happen. Are you running multiple Jobber instances on the same host? Did Jobber previously crash? containerId: ${shortenString(
          container.ID
        )}, containerNames: ${container.Names}`
      );

      const result = await stopDockerContainer(container.ID);

      if (result) {
        console.log(
          "[RunnerManager/loopCheckDockerContainers] Killed dangling container successfully."
        );
      } else {
        console.log(
          "[RunnerManager/loopCheckDockerContainers] Failed to kill dangling container!"
        );
      }
    }
  }

  private async loopRunnerSpawner(
    currentActions: { action: ActionsTableType; job: JobsTableType }[]
  ) {
    for (const currentAction of currentActions) {
      const action = currentAction.action;
      const job = currentAction.job;

      const runnersCurrent = Object.values(this.runners).filter(
        (runner) => runner.action.id === action.id
      );

      if (action.runnerMode !== "standard") {
        continue;
      }

      const actionLoad = runnersCurrent.reduce(
        (prev, runner) => (runner.requestsProcessing + prev) / 2,
        0
      );

      const targetLoadPerRunner = action.runnerAsynchronous ? 10 : 1;

      let targetRunnerCount = Math.floor(
        (actionLoad / targetLoadPerRunner) * 1.2
      );

      if (Number.isNaN(targetRunnerCount)) {
        targetRunnerCount = 0;
      }

      if (this.requestedActionIds.has(action.id)) {
        this.requestedActionIds.delete(action.id);

        if (targetRunnerCount <= 0) {
          targetRunnerCount++;
        }
      }

      if (targetRunnerCount > action.runnerMaxCount) {
        targetRunnerCount = action.runnerMaxCount;
      }

      if (targetRunnerCount < action.runnerMinCount) {
        targetRunnerCount = action.runnerMinCount;
      }

      const count = targetRunnerCount - runnersCurrent.length;

      if (count > 0) {
        console.log(
          `[Runners/loopRunnerSpawner] Spawning ${count} new runners. jobName ${
            job.jobName
          }, jobId ${shortenString(job.id)}, actionId ${shortenString(
            action.id
          )}`
        );

        for (let i = 0; i < count; i++) {
          const runnerId = await this.createRunner(action, {
            dockerNamePrefix: job.jobName,
          });

          await this.server.awaitConnectionStatus(runnerId, "ready");
        }
      }
    }
  }

  private async loopCheckEnvironmentChanges(
    currentActions: {
      action: ActionsTableType;
      job: JobsTableType;
      environment: EnvironmentsTableType | null;
    }[]
  ) {
    for (const [_runnerId, runner] of Object.entries(this.runners)) {
      if (runner.status !== "starting" && runner.status !== "ready") {
        continue;
      }

      const currentAction = currentActions.find(
        (index) => index.action.id === runner.action.id
      );

      if (!currentAction) {
        continue;
      }

      if (!runner.environment && !currentAction.environment) {
        continue;
      }

      // Runner started with no environment, and environment has since been configured.
      if (!runner.environment && currentAction.environment) {
        await this.server.sendShutdownRequest(runner.id);

        continue;
      }

      // Runner started with an environment, and its since been deleted.
      if (runner.environment && !currentAction.environment) {
        await this.server.sendShutdownRequest(runner.id);

        continue;
      }

      // Runners environment updated while it was running
      if (
        runner.environment?.modified !== currentAction.environment?.modified
      ) {
        await this.server.sendShutdownRequest(runner.id);

        continue;
      }
    }
  }

  private async loopCheckVersion(
    currentActions: { action: ActionsTableType; job: JobsTableType }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (
        currentActions.some((index) => index.action.id === runner.action.id)
      ) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckVersion] Shutting down ${shortenString(
          runner.id
        )}`
      );

      await this.server.sendShutdownRequest(runner.id);
    }
  }

  private async loopCheckMaxAge(
    currentActions: { action: ActionsTableType; job: JobsTableType }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (!runner.readyAt) {
        continue;
      }

      const duration = getUnixTimestamp() - runner.readyAt;

      if (duration < runner.action.runnerMaxAge) {
        continue;
      }

      await this.server.sendShutdownRequest(runner.id);
    }
  }

  private async loopCheckHardMaxAge(
    currentActions: { action: ActionsTableType; job: JobsTableType }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (!runner.readyAt) {
        continue;
      }

      const duration = getUnixTimestamp() - runner.readyAt;

      if (duration < runner.action.runnerMaxAgeHard) {
        continue;
      }

      runner.process.kill("SIGTERM");
    }
  }
}
