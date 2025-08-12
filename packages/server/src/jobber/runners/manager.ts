import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { and, eq, isNotNull } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { getConfigOption } from "~/config.js";
import { ENTRYPOINT_NODE } from "~/constants.js";
import { getDrizzle } from "~/db/index.js";
import { actionsTable, ActionsTableType } from "~/db/schema/actions.js";
import {
  environmentsTable,
  EnvironmentsTableType,
} from "~/db/schema/environments.js";
import {
  jobVersionsTable,
  JobVersionsTableType,
} from "~/db/schema/job-versions.js";
import { jobsTable, JobsTableType } from "~/db/schema/jobs.js";
import { getDockerContainers, stopDockerContainer } from "~/docker.js";
import { LoopBase } from "~/loop-base.js";
import {
  counterRunnerRequests,
  gaugeActiveRunners,
  histogramJobManagerLoopDuration,
  histogramRunnerRequestDuration,
  histogramRunnerShutdownDuration,
  histogramRunnerStartupDuration,
} from "~/metrics.js";
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
import { Store } from "../store.js";
import { HandleRequest, HandleResponse, RunnerServer } from "./server.js";

type RunnerManagerItem = {
  status: "starting" | "ready" | "closing" | "closed";

  id: string;
  version: JobVersionsTableType;
  action: ActionsTableType;
  job: JobsTableType;
  environment: EnvironmentsTableType | null;

  process: ChildProcessWithoutNullStreams;

  requestsProcessing: number;

  lastRequestAt?: number;
  createdAt: number;
  readyAt?: number;
  closingAt?: number;
  closedAt?: number;
};

@singleton()
export class RunnerManager extends LoopBase {
  protected loopDuration = 500;
  protected loopClosing = undefined;
  protected loopStarting = undefined;

  private server: RunnerServer;

  private runners: Record<string, RunnerManagerItem> = {};

  private requestedVersionIds = new Set<string>();

  private danglingLastRun = 0;

  constructor(
    @inject("LogDriverBase") private logger: LogDriverBase,
    @inject(Store) private store: Store
  ) {
    super();

    this.server = new RunnerServer(this.store);

    this.server.on("runner-starting", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        console.warn(
          `[RunnerManager/runner-starting] Runner not found for id ${runnerId}`
        );

        return;
      }

      runner.status = "starting";
    });

    this.server.on("runner-ready", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        console.warn(
          `[RunnerManager/runner-ready] Runner not found for id ${runnerId}`
        );

        return;
      }

      runner.readyAt = getUnixTimestamp();
      runner.status = "ready";

      console.log(
        `[RunnerManager/runner-ready] Runner is ready at ${new Date(
          runner.readyAt * 1000
        ).toISOString()}`
      );

      histogramRunnerStartupDuration
        .labels({
          job_id: runner.job.id,
          job_name: runner.job.jobName,
          version: runner.version.version,
        })
        .observe(runner.readyAt - runner.createdAt);
    });

    this.server.on("runner-closing", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        console.warn(
          `[RunnerManager/runner-closing] Runner not found for id ${runnerId}`
        );

        return;
      }

      runner.closingAt = getUnixTimestamp();
      runner.status = "closing";
    });

    this.server.on("runner-close", (runnerId) => {
      const runner = this.runners[runnerId];

      if (!runner) {
        console.warn(
          `[RunnerManager/runner-close] Runner not found for id ${runnerId}. Was process forcefully killed?`
        );

        return;
      }

      runner.closedAt = getUnixTimestamp();
      runner.status = "closed";
      runner.process.kill("SIGKILL");

      if (runner.closingAt) {
        histogramRunnerShutdownDuration
          .labels({
            job_id: runner.job.id,
            job_name: runner.job.jobName,
            version: runner.version.version,
          })
          .observe(runner.closingAt - runner.closedAt);
      }
    });
  }

  protected async loopStarted() {
    await this.server.start();
  }

  protected async loopClosed() {
    await this.loopClose();
    await this.server.stop();
  }

  protected async loopIteration() {
    const benchmark = createBenchmark();
    const end = histogramJobManagerLoopDuration.startTimer();

    const currentVersions = await getDrizzle()
      .select({
        version: jobVersionsTable,
        job: jobsTable,
        action: actionsTable,
        environment: environmentsTable,
      })
      .from(jobsTable)
      .innerJoin(
        jobVersionsTable,
        and(
          eq(jobsTable.id, jobVersionsTable.jobId),
          eq(jobsTable.jobVersionId, jobVersionsTable.id)
        )
      )
      .innerJoin(
        actionsTable,
        and(
          eq(jobsTable.id, actionsTable.jobId),
          eq(jobsTable.jobVersionId, actionsTable.jobVersionId)
        )
      )
      .leftJoin(environmentsTable, eq(environmentsTable.jobId, jobsTable.id))
      .where(
        and(isNotNull(jobsTable.jobVersionId), eq(jobsTable.status, "enabled"))
      );

    await Promise.all(
      currentVersions.map(async (item) => this.loopRunnerSpawner([item]))
    );

    await this.loopCheckEnvironmentChanges(currentVersions);
    await this.loopCheckVersion(currentVersions);
    await this.loopCheckMaxAge(currentVersions);
    await this.loopCheckHardMaxAge(currentVersions);
    await this.loopCheckMaxIdleAge(currentVersions);

    if (getUnixTimestamp() - this.danglingLastRun > 60) {
      await this.loopCheckDanglingContainers(currentVersions);

      this.danglingLastRun = getUnixTimestamp();
    }

    const benchmarkResult = benchmark();
    if (benchmarkResult >= 10_000) {
      console.log(
        `[RunnerManager/loop] loop iteration exceeded 10,000ms (10s), took ${benchmarkResult.toFixed(
          2
        )}ms to complete!`
      );
    }

    end();
  }

  public async sendHandleRequest(
    version: JobVersionsTableType,
    job: JobsTableType,
    action: ActionsTableType,
    handleRequest: HandleRequest
  ): Promise<HandleResponse> {
    assert(action.jobVersionId === version.id);

    const activeRunners = Object.values(this.runners).filter(
      (index) => index.version.id === version.id
    );

    if (action.runnerMode === "run-once") {
      const canCreateRunner =
        action.runnerMaxCount === 0 ||
        activeRunners.length < action.runnerMaxCount;

      if (!canCreateRunner) {
        console.warn(
          `[RunnerManager/sendHandleRequest] Failed to start runner, allocation of runners exhausted. actionRunners.length ${activeRunners.length}`
        );

        return {
          success: false,
          duration: -1,
          error: "Jobber: Failed to start runner.",
        };
      }

      const runnerId = await this.createRunner(version, action, job, {
        dockerNamePrefix: job.jobName,
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
        runner.lastRequestAt = getUnixTimestamp();
        runner.requestsProcessing++;

        result = await this.server.sendHandleRequest(runner.id, handleRequest);

        // Timeout is only here for run-once mode
        await timeout(100);
      } finally {
        runner.requestsProcessing--;

        await this.server.sendShutdownRequest(runner.id);
      }

      histogramRunnerRequestDuration
        .labels({
          job_name: runner.job.jobName,
          job_id: runner.job.id,
          version: version.version,
          trigger_type: handleRequest.type,
        })
        .observe(result.duration);

      counterRunnerRequests
        .labels({
          job_name: runner.job.jobName,
          job_id: runner.job.id,
          version: version.version,
          trigger_type: handleRequest.type,
          success: result.success ? 1 : 0,
        })
        .inc();

      return result;
    }

    if (action.runnerMode === "standard") {
      const runnersPool = activeRunners
        .filter((index) => index.status === "ready")
        .sort((a, b) => a.requestsProcessing - b.requestsProcessing);

      // Start new runner
      if (runnersPool.length <= 0) {
        this.requestedVersionIds.add(version.id);

        await awaitTruthy(async () =>
          Object.values(this.runners).some(
            (index) =>
              index.version.id === version.id && index.status === "ready"
          )
        );

        const runners = Object.values(this.runners).filter(
          (index) => index.version.id === version.id && index.status === "ready"
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

        runnersPool.push(...runners);
      }

      const runner = runnersPool.at(0);

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
        runner.lastRequestAt = getUnixTimestamp();
        runner.requestsProcessing++;

        result = await this.server.sendHandleRequest(runner.id, handleRequest);
      } finally {
        runner.requestsProcessing--;
      }

      histogramRunnerRequestDuration
        .labels({
          job_name: runner.job.jobName,
          job_id: runner.job.id,
          version: version.version,
          trigger_type: handleRequest.type,
        })
        .observe(result.duration);

      counterRunnerRequests
        .labels({
          job_name: runner.job.jobName,
          job_id: runner.job.id,
          version: version.version,
          trigger_type: handleRequest.type,
          success: result.success ? 1 : 0,
        })
        .inc();

      return result;
    }

    throw new Error(
      `[RunnerManager/sendHandleRequest] Unexpected runner mode.`
    );
  }

  public async sendShutdownGraceful(jobId: string, runnerId: string) {
    const runner = this.runners[runnerId];

    console.log(
      `[RunnerManager/sendShutdownGraceful] Shutting down runner ${shortenString(
        runnerId
      )} for job ${shortenString(jobId)}`
    );

    if (!runner || runner.job.id !== jobId) {
      console.warn(
        `[RunnerManager/sendShutdownGraceful] Runner not found for jobId ${shortenString(
          jobId
        )} and runnerId ${shortenString(runnerId)}`
      );

      return {
        success: false,
        message: "Runner not found",
      } as const;
    }

    await awaitTruthy(
      async () =>
        runner.status === "ready" ||
        runner.status === "closing" ||
        runner.status === "closed",
      10_000
    );

    if (runner.status === "starting") {
      console.warn(
        `[RunnerManager/sendShutdownGraceful] Runner is still starting, cannot shutdown gracefully. runnerId ${shortenString(
          runnerId
        )}, jobId ${shortenString(jobId)}`
      );

      return {
        success: false,
        message: "Runner is still starting, cannot shutdown gracefully",
      } as const;
    }

    if (runner.status === "closed") {
      console.warn(
        `[RunnerManager/sendShutdownGraceful] Runner has already closed. runnerId ${shortenString(
          runnerId
        )}, jobId ${shortenString(jobId)}`
      );

      return {
        success: false,
        message: "Runner has already closed",
      } as const;
    }

    if (runner.status === "closing") {
      console.warn(
        `[RunnerManager/sendShutdownGraceful] Runner is already closing. runnerId ${shortenString(
          runnerId
        )}, jobId ${shortenString(jobId)}`
      );

      return {
        success: true,
        message: "Runner is already closing",
      } as const;
    }

    const response = await this.server.sendShutdownRequest(runner.id);

    if (!response) {
      console.warn(
        `[RunnerManager/sendShutdownGraceful] Failed to send shutdown request to runner. runnerId ${shortenString(
          runnerId
        )}, jobId ${shortenString(jobId)}`
      );

      return {
        success: false,
        message: "Failed to send shutdown request to runner",
      } as const;
    }

    console.log(
      `[RunnerManager/sendShutdownGraceful] Runner shutdown request sent successfully. runnerId ${shortenString(
        runnerId
      )}, jobId ${shortenString(jobId)}`
    );

    return {
      success: true,
    } as const;
  }

  public async sendShutdownForceful(jobId: string, runnerId: string) {
    const runner = this.runners[runnerId];

    console.log(
      `[RunnerManager/sendShutdownForceful] Forcefully shutting down runner ${shortenString(
        runnerId
      )} for job ${shortenString(jobId)}`
    );

    if (!runner || runner.job.id !== jobId) {
      console.warn(
        `[RunnerManager/sendShutdownForceful] Runner not found for jobId ${shortenString(
          jobId
        )} and runnerId ${shortenString(runnerId)}`
      );

      return {
        success: false,
        message: "Runner not found",
      } as const;
    }

    if (runner.status === "closed") {
      console.warn(
        `[RunnerManager/sendShutdownForceful] Runner has already closed. runnerId ${shortenString(
          runnerId
        )}, jobId ${shortenString(jobId)}`
      );

      return {
        success: false,
        message: "Runner is already closed",
      } as const;
    }

    runner.process.kill("SIGKILL");

    console.log(
      `[RunnerManager/sendShutdownForceful] Runner process killed. runnerId ${shortenString(
        runnerId
      )}, jobId ${shortenString(jobId)}`
    );

    return {
      success: true,
      message: "Runner process has been killed forcefully.",
    } as const;
  }

  public async getRunners() {
    return Object.values(this.runners).map((index) => ({
      status: index.status,
      jobId: index.action.jobId,
      actionId: index.action.id,
      id: index.id,
      requestsProcessing: index.requestsProcessing,
      lastRequestAt: index.lastRequestAt,
      createdAt: index.createdAt,
      readyAt: index.readyAt,
      closingAt: index.closingAt,
      closedAt: index.closedAt,
    }));
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
        lastRequestAt: index.lastRequestAt,
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
        lastRequestAt: index.lastRequestAt,
        createdAt: index.createdAt,
        readyAt: index.readyAt,
        closingAt: index.closingAt,
        closedAt: index.closedAt,
      }));
  }

  private async createRunner(
    version: JobVersionsTableType,
    action: ActionsTableType,
    job: JobsTableType,
    options?: {
      dockerNamePrefix?: string;
    }
  ) {
    assert(action.jobVersionId === version.id);

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

    this.server.registerConnection(id, action, version);

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

    const environment = await getDrizzle()
      .select()
      .from(environmentsTable)
      .where(eq(environmentsTable.jobId, action.jobId))
      .limit(1)
      .then((res) => res.at(0) ?? null);
    //

    const args: string[] = [];

    args.push("run", "--rm", "--name", id);

    args.push("--label", "jobber=true");
    args.push("--label", `jobber-manager=${getConfigOption("JOBBER_NAME")}`);

    const dockerNetwork = getConfigOption("RUNNER_CONTAINER_DOCKER_NETWORK");
    if (dockerNetwork) {
      args.push("--network", dockerNetwork);
    }

    if (environment) {
      for (const [name, { value }] of Object.entries(environment.context)) {
        args.push("--env", `${name}=${value}`);
      }
    }

    const actionArgumentsEnabled = getConfigOption(
      "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES"
    );

    if (
      actionArgumentsEnabled.includes("networks") &&
      action.runnerDockerArguments.networks
    ) {
      for (const network of action.runnerDockerArguments.networks) {
        args.push("--network", network);
      }
    } else if (action.runnerDockerArguments.networks) {
      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Action is using docker networks, but RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES does not include "networks". Skipping networks.`,
      });
    }

    if (
      actionArgumentsEnabled.includes("volumes") &&
      action.runnerDockerArguments.volumes
    ) {
      for (const volume of action.runnerDockerArguments.volumes) {
        args.push(
          "--volume",
          `${volume.source}:${volume.target}:${volume.mode}`
        );
      }
    } else if (action.runnerDockerArguments.volumes) {
      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Action is using docker volumes, but RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES does not include "volumes". Skipping volumes.`,
      });
    }

    if (
      actionArgumentsEnabled.includes("labels") &&
      action.runnerDockerArguments.labels
    ) {
      for (const label of action.runnerDockerArguments.labels) {
        if (["jobber-manager", "jobber"].includes(label.key.toLowerCase())) {
          continue;
        }

        args.push("--label", `${label.key}=${label.value}`);
      }
    } else if (action.runnerDockerArguments.labels) {
      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Action is using docker labels, but RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES does not include "labels". Skipping labels.`,
      });
    }

    if (
      actionArgumentsEnabled.includes("memoryLimit") &&
      action.runnerDockerArguments.memoryLimit
    ) {
      args.push("--memory", action.runnerDockerArguments.memoryLimit);
    } else if (action.runnerDockerArguments.memoryLimit) {
      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Action is using docker memory limit, but RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES does not include "memoryLimit". Skipping memory limit.`,
      });
    }

    if (
      getConfigOption("RUNNER_ALLOW_ARGUMENT_DIRECT_PASSTHROUGH") &&
      actionArgumentsEnabled.includes("directPassthroughArguments") &&
      action.runnerDockerArguments.directPassthroughArguments
    ) {
      args.push(...action.runnerDockerArguments.directPassthroughArguments);
    } else if (action.runnerDockerArguments.directPassthroughArguments) {
      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Action is using docker direct passthrough arguments, but RUNNER_ALLOW_ARGUMENT_DIRECT_PASSTHROUGH is not enabled, or RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES does not include "directPassthroughArguments". Skipping direct passthrough arguments.`,
      });
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
      getConfigOption("MANAGER_PORT").toString(),
      "--job-debug",
      getConfigOption("DEBUG_RUNNER") ? "true" : "false"
    );

    if (getConfigOption("DEBUG_RUNNER")) {
      const secureArgs: string[] = [];

      const secureValues: string[] = [];

      if (environment) {
        for (const [name, value] of Object.entries(environment.context)) {
          if (value.type === "secret") {
            secureValues.push(value.value);
          }
        }
      }

      for (const argItem of args) {
        let argItemClean = argItem;

        for (const secretValue of secureValues) {
          argItemClean = argItemClean.replace(secretValue, "<redacted>");
        }

        secureArgs.push(argItemClean);
      }

      this.logger.write({
        actionId: action.id,
        jobId: job.id,
        jobName: job.jobName,
        created: new Date(),
        source: "system",
        message: `[RunnerManager/createRunner] Starting runner with arguments: ${JSON.stringify(
          secureArgs
        )}`,
      });
    }

    const process = spawn("docker", args, {
      windowsHide: true,
      stdio: "pipe",
    });

    process.once("exit", () => {
      delete this.runners[id];

      gaugeActiveRunners
        .labels({
          job_name: job.jobName,
          job_id: job.id,
          version: version.version,
        })
        .dec();
    });

    process.stderr.on("data", (buffer: Buffer) => {
      const chunks = buffer.toString().split("\n");
      for (const chunk of chunks) {
        this.logger.write({
          actionId: action.id,
          jobId: job.id,
          jobName: job.jobName,
          created: new Date(),
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
          jobId: job.id,
          jobName: job.jobName,
          created: new Date(),
          source: "runner",
          message: chunk.toString(),
        });
      }
    });

    this.runners[id] = {
      action,
      version,
      job,
      createdAt: getUnixTimestamp(),
      environment,
      id,
      process,
      requestsProcessing: 0,
      status: "starting",
    };

    gaugeActiveRunners
      .labels({
        job_name: job.jobName,
        job_id: job.id,
        version: version.version,
      })
      .inc();

    return id;
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
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
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

      const jobberManager = labels
        .find(([labelName]) => labelName === "jobber-manager")
        ?.at(1);

      if (jobberManager !== getConfigOption("JOBBER_NAME")) {
        if (getConfigOption("DEBUG_RUNNER")) {
          console.log(
            `[RunnerManager/loopCheckDanglingContainers] Found dangling container that is not owned by this Jobber instance. container: ${container.ID}, jobber-owner: ${jobberManager}`
          );
        }

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
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const currentVersion of currentVersions) {
      const action = currentVersion.action;
      const job = currentVersion.job;
      const version = currentVersion.version;

      const runnersCurrent = Object.values(this.runners).filter(
        (runner) => runner.version.id === version.id
      );

      if (action.runnerMode !== "standard") {
        continue;
      }

      const runnerLoad = runnersCurrent.reduce(
        (prev, runner) => (runner.requestsProcessing + prev) / 2,
        0
      );

      const targetLoadPerRunner = action.runnerAsynchronous ? 10 : 1;

      let targetRunnerCount = Math.floor(
        (runnerLoad / targetLoadPerRunner) * 1.2
      );

      if (Number.isNaN(targetRunnerCount)) {
        targetRunnerCount = 0;
      }

      if (this.requestedVersionIds.has(version.id)) {
        this.requestedVersionIds.delete(version.id);

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
          )}, version ${version.version}, versionId ${shortenString(
            version.id
          )}`
        );

        for (let i = 0; i < count; i++) {
          const runnerId = await this.createRunner(version, action, job, {
            dockerNamePrefix: job.jobName,
          });

          await this.server.awaitConnectionStatus(runnerId, "ready");
        }
      }
    }
  }

  private async loopCheckEnvironmentChanges(
    currentVersions: {
      version: JobVersionsTableType;
      action: ActionsTableType;
      job: JobsTableType;
      environment: EnvironmentsTableType | null;
    }[]
  ) {
    for (const [_runnerId, runner] of Object.entries(this.runners)) {
      if (runner.status !== "starting" && runner.status !== "ready") {
        continue;
      }

      const currentVersion = currentVersions.find(
        (index) => index.version.id === runner.version.id
      );

      if (!currentVersion) {
        continue;
      }

      if (!runner.environment && !currentVersion.environment) {
        continue;
      }

      // Runner started with no environment, and environment has since been configured.
      if (!runner.environment && currentVersion.environment) {
        console.log(
          `[RunnerManager/loopCheckEnvironmentChanges] Shutting down ${shortenString(
            runner.id
          )} due to environment change. Runner started without environment, but environment has now been configured.`
        );

        await this.server.sendShutdownRequest(runner.id);

        continue;
      }

      // Runner started with an environment, and its since been deleted.
      if (runner.environment && !currentVersion.environment) {
        console.log(
          `[RunnerManager/loopCheckEnvironmentChanges] Shutting down ${shortenString(
            runner.id
          )} due to environment change. Runner started with an environment, but environment has now been deleted.`
        );

        await this.server.sendShutdownRequest(runner.id);

        continue;
      }

      // Runners environment updated while it was running
      if (
        runner.environment?.modified !== currentVersion.environment?.modified
      ) {
        console.log(
          `[RunnerManager/loopCheckEnvironmentChanges] Shutting down ${shortenString(
            runner.id
          )} due to environment change. Environment has been updated while runner was running.`
        );

        await this.server.sendShutdownRequest(runner.id);

        continue;
      }
    }
  }

  private async loopCheckVersion(
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (
        currentVersions.some((index) => index.version.id === runner.version.id)
      ) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckVersion] Shutting down ${shortenString(
          runner.id
        )} due to action version change.`
      );

      await this.server.sendShutdownRequest(runner.id);
    }
  }

  private async loopCheckMaxAge(
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (!runner.readyAt) {
        continue;
      }

      if (runner.action.runnerMaxAge === 0) {
        continue;
      }

      const duration = getUnixTimestamp() - runner.readyAt;

      if (duration < runner.action.runnerMaxAge) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckMaxAge] Shutting down ${shortenString(
          runner.id
        )} due to max age exceeded. duration ${duration}s, maxAge ${
          runner.action.runnerMaxAge
        }s`
      );

      await this.server.sendShutdownRequest(runner.id);
    }
  }

  private async loopCheckHardMaxAge(
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      if (!runner.readyAt) {
        continue;
      }

      if (runner.action.runnerMaxAgeHard === 0) {
        continue;
      }

      const duration = getUnixTimestamp() - runner.readyAt;

      if (duration < runner.action.runnerMaxAgeHard) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckHardMaxAge] Shutting down ${shortenString(
          runner.id
        )} due to hard max age exceeded. duration ${duration}s, hardMaxAge ${
          runner.action.runnerMaxAgeHard
        }s`
      );

      runner.process.kill("SIGTERM");
    }
  }

  private async loopCheckMaxIdleAge(
    currentVersions: {
      action: ActionsTableType;
      version: JobVersionsTableType;
      job: JobsTableType;
    }[]
  ) {
    for (const runner of Object.values(this.runners)) {
      const lastRequestAtEffective =
        typeof runner.lastRequestAt === "number"
          ? runner.lastRequestAt
          : runner.readyAt;

      if (!runner.readyAt || !lastRequestAtEffective) {
        continue;
      }

      if (runner.action.runnerMaxIdleAge === 0) {
        continue;
      }

      const duration = getUnixTimestamp() - lastRequestAtEffective;

      if (duration < runner.action.runnerMaxIdleAge) {
        continue;
      }

      console.log(
        `[RunnerManager/loopCheckMaxIdleAge] Shutting down ${shortenString(
          runner.id
        )} due to max idle age exceeded. duration ${duration}s, maxIdleAge ${
          runner.action.runnerMaxIdleAge
        }s`
      );

      await this.server.sendShutdownRequest(runner.id);
    }
  }
}
