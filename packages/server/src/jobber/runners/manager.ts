import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  Channel,
  Client,
  ClientError,
  createChannel,
  createClientFactory,
  Metadata,
  Status,
} from "nice-grpc";
import { inject, singleton } from "tsyringe";

import { LoopBase, timeout } from "@jobber/common";
import { Deferred, deferred } from "@jobber/common/deferred.js";
import { getOAuthAudienceRunnerApi } from "@jobber/common/oauth.js";
import {
  EventMqttRequest,
  EventMqttResponse,
  EventScheduleRequest,
  EventScheduleResponse,
  RunnerAPIDefinition,
  StatusResponse,
} from "@jobber/grpc/runner.js";
import { unlink, writeFile } from "fs/promises";
import { getConfigOption } from "~/config.js";
import { ENTRYPOINT_NODE } from "~/constants.js";
import { actionsModel } from "~/db/actions.js";
import { environmentModel } from "~/db/environment.js";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsModel } from "~/db/job-versions.js";
import { jobModel } from "~/db/job.js";
import { runnersModel } from "~/db/runners.js";
import {
  actionsTable,
  environmentsTable,
  jobsTable,
  jobVersionsTable,
} from "~/db/schema.js";
import {
  ActionsTableType,
  EnvironmentsTableType,
  JobsTableType,
  JobVersionsTableType,
  RunnersTableType,
} from "~/db/types.js";
import {
  getDockerContainers,
  killDockerContainer,
  stopDockerContainer,
} from "~/docker.js";
import { getRunnerEnvFile } from "~/paths.js";
import { OAuthServiceClients } from "~/service-clients.js";
import {
  createToken,
  getUnixTimestamp,
  sanitiseSafeCharacters,
  shortenString,
} from "~/util.js";
import { getImage } from "../images.js";
import { LogDriverBase } from "../log-drivers/abstract.js";

type CurrentVersionResult = {
  version: JobVersionsTableType;
  job: JobsTableType;
  action: ActionsTableType;
  environment: EnvironmentsTableType | null;
};

type RunnerManagerItem = {
  runnerId: string;

  job: JobsTableType;
  jobVersion: JobVersionsTableType;
  jobAction: ActionsTableType;
  environment: EnvironmentsTableType | null;

  process: ChildProcessWithoutNullStreams;

  properties: RunnersTableType["properties"];

  // Arguments passed through to the runner
  arguments: {
    runnerId: string;

    runnerClientId: string;
    runnerClientSecret: string;
    runnerGeneralApiEndpoint: string;

    runnerOAuthTokenEndpoint: string;
    runnerOAuthJwksEndpoint: string;
    runnerOAuthIssuer: string;

    runnerApiPort: number;

    runnerDebug: boolean;
  };

  lastStatus?: StatusResponse;

  grpcToken: string | null;
  grpcTokenExpiry: number | null;
  grpcMetadata: Metadata;
  grpcChannel: Channel | null;
  grpc: Client<RunnerAPIDefinition> | null;

  promiseEvents: {
    ready: Deferred<void>;
    closing: Deferred<void>;
    closed: Deferred<void>;
  };

  createdAt: number;
};

type RunnerManagerStartupItem = {
  jobId: string;

  startupPromise: Deferred<string | null>;
};

type RunnerManagerShutdownItem = {
  runnerId: string;
  method: "graceful" | "forceful";
};

@singleton()
export class RunnerManager extends LoopBase {
  protected loopDuration = 250;
  protected loopClosing = undefined;
  protected loopStarting = undefined;

  private runners = new Map<string, RunnerManagerItem>();

  private queueShutdown = Array<RunnerManagerShutdownItem>();

  private queueStartup = Array<RunnerManagerStartupItem>();

  constructor(
    @inject("LogDriverBase") private logger: LogDriverBase,
    @inject(OAuthServiceClients) private serviceClients: OAuthServiceClients,
  ) {
    super();
  }

  protected async loopIteration() {
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
          eq(jobsTable.jobVersionId, jobVersionsTable.id),
        ),
      )
      .innerJoin(
        actionsTable,
        and(
          eq(jobsTable.id, actionsTable.jobId),
          eq(jobsTable.jobVersionId, actionsTable.jobVersionId),
        ),
      )
      .leftJoin(environmentsTable, eq(environmentsTable.jobId, jobsTable.id))
      .where(
        and(isNotNull(jobsTable.jobVersionId), eq(jobsTable.status, "enabled")),
      );

    // TODO: RUN LESS FREQUENTLY!!!
    await this.checkDanglingRunners();

    // TODO: query the runners less frequently.. every few seconds feels more appropriate.
    await Promise.all(
      Array.from(this.runners.keys()).map((runnerId) =>
        this.updateRunnerStatus(runnerId),
      ),
    );

    await Promise.all(
      Array.from(this.runners.keys()).map((runnerId) =>
        this.checkRunner(runnerId, currentVersions),
      ),
    );

    await Promise.all(
      currentVersions.map((currentVersion) =>
        this.checkScaling(currentVersion),
      ),
    );

    await this.processStartupQueue();
    await this.processShutdownQueue();
  }

  protected async loopStarted(): Promise<void> {
    //
  }

  protected async loopClosed(): Promise<void> {
    for (const runner of this.runners.values()) {
      await this.shutdownQueueAdd(runner.runnerId, false);
    }

    await this.processShutdownQueue();
  }

  private async updateRunnerStatus(runnerId: string) {
    try {
      const runner = this.runners.get(runnerId);

      if (!runner) {
        console.warn(
          `[RunnerManager/updateRunnerStatus] Runner ${runnerId} not found in manager's runner list.`,
        );
        return;
      }

      if (!runner.grpc) {
        console.warn(
          `[RunnerManager/updateRunnerStatus] Runner ${runnerId} does not have gRPC client initialized yet.`,
        );
        return;
      }

      if (runner.process.killed) {
        console.warn(
          `[RunnerManager/updateRunnerStatus] Runner ${runnerId} process is killed but still in runner list. Removing...`,
        );
        // Cleanup is handled in process 'exit' event.
        return;
      }

      if (
        runner.grpcTokenExpiry &&
        getUnixTimestamp() > runner.grpcTokenExpiry - 60
      ) {
        // Token is expired or about to expire in the next 60 seconds, generate a new one

        const tokenResult = await this.serviceClients.generateTokenForServer(
          getOAuthAudienceRunnerApi(runnerId),
        );

        runner.grpcMetadata.set("Authorization", `Bearer ${tokenResult.jwt}`);
        runner.grpcToken = tokenResult.jwt;
        runner.grpcTokenExpiry = Math.floor(
          tokenResult.expiration.getTime() / 1000,
        );
      }

      try {
        const previousStatus = runner.lastStatus?.status;

        const status = await runner.grpc.status({});

        runner.lastStatus = status;

        if (status.status === "READY" && previousStatus !== "READY") {
          await runnersModel.update(runner.runnerId, {
            status: "ready",
            readyAt: new Date(),
          });

          runner.promiseEvents.ready.resolve();
        }
      } catch (err) {
        // When lastStatus is undefined, runner has not started yet. Ignore unavailable errors
        // TODO: Possibly add other checks here?
        if (
          err instanceof ClientError &&
          err.code === Status.UNAVAILABLE &&
          runner.lastStatus === undefined
        ) {
          return;
        }

        throw err;
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async checkRunner(
    runnerId: string,
    currentVersions: CurrentVersionResult[],
  ) {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      return;
    }

    const currentVersion = currentVersions.find(
      (item) => item.version.id === runner.jobVersion.id,
    );

    if (!currentVersion) {
      // Send shutdown - job no longer has a version attached to it.

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Check if its running the expected version
    if (runner.jobVersion.id !== currentVersion.version.id) {
      // Send shutdown

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Check max age
    if (
      runner.jobAction.runnerMaxAge &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAge
    ) {
      // Send shutdown

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Check hard max age
    if (
      runner.jobAction.runnerMaxAgeHard &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAgeHard
    ) {
      // Send shutdown

      this.shutdownQueueAdd(runnerId, true);

      return;
    }

    // Check max idle age
    if (
      runner.jobAction.runnerMaxIdleAge &&
      runner.lastStatus?.lastRequestAt &&
      getUnixTimestamp() >
        runner.lastStatus?.lastRequestAt + runner.jobAction.runnerMaxIdleAge
    ) {
      // Send shutdown

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Environment Changes - runner started without environment, but now has one
    if (!runner.environment && currentVersion.environment) {
      // Send shutdown - environment added

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Environment Changes - runner started with environment, but now doesn't have one
    if (runner.environment && !currentVersion.environment) {
      // Send shutdown - environment removed

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }

    // Environment Changes - runner started with environment, but it has been modified
    if (
      runner.environment &&
      currentVersion.environment &&
      runner.environment.modified !== currentVersion.environment.modified
    ) {
      // Send shutdown - environment modified

      this.shutdownQueueAdd(runner.runnerId, false);

      return;
    }
  }

  private async checkScaling({
    action,
    environment,
    job,
    version,
  }: CurrentVersionResult) {
    //

    if (action.runnerMode !== "standard") {
      // Will startup adhoc
      return;
    }

    const runnerCurrent = Array.from(this.runners.values()).filter(
      (runner) => runner.jobVersion.id === version.id,
    );

    // Average load for past 5 seconds
    const averageLoad = runnerCurrent.reduce(
      (acc, runner) =>
        ((runner.lastStatus?.loadAverage5Seconds ?? 0) + acc) / 2,
      0,
    );

    const targetLoadPerRunner = action.runnerAsynchronous ? 60 : 1;

    let targetRunnerCount = Math.floor(
      (averageLoad / targetLoadPerRunner) * 1.2,
    );

    if (isNaN(targetRunnerCount)) {
      targetRunnerCount = 0;
    }

    if (targetRunnerCount > action.runnerMaxCount) {
      targetRunnerCount = action.runnerMaxCount;
    }

    if (targetRunnerCount < action.runnerMinCount) {
      targetRunnerCount = action.runnerMinCount;
    }

    const spawnQuantity = targetRunnerCount - runnerCurrent.length;

    if (spawnQuantity > 0) {
      for (let i = 0; i < spawnQuantity; i++) {
        this.startupQueueAdd(job.id);
      }
    }
  }

  private async checkDanglingRunners() {
    // TODO: Cleanup this
    const runnerRecordsNotClosed = await runnersModel.byStatuses([
      "starting",
      "ready",
      "closing",
    ]);

    const containers = await getDockerContainers();

    await Promise.all(
      runnerRecordsNotClosed.map(async (runnerRecord) => {
        const isKnown = this.runners.has(runnerRecord.id);

        if (isKnown) {
          return;
        }

        console.warn(
          `[RunnerManager/checkDanglingRunners] Found dangling runner record ${runnerRecord.id} for job ${runnerRecord.jobId}. Marking as closed...`,
        );

        await runnersModel.update(runnerRecord.id, {
          status: "closed",
          closedAt: new Date(),
        });

        const container = containers.find(
          (container) =>
            container.Names === runnerRecord.properties?.runnerContainerName,
        );

        if (container) {
          await stopDockerContainer(container.ID).catch((err) => {});
        }
      }),
    );

    // await Promise.all(
    //   containers.map(async (container) => {
    //     const labels = container.Labels.split(",").map((label) => {
    //       const parts = label.split("=", 2);

    //       return {
    //         key: parts.at(0) ?? "",
    //         value: parts.at(1) ?? "",
    //       };
    //     });

    //     const isJobber = labels.find(
    //       ({ key, value }) => key === "jobber" && value === "true",
    //     );

    //     const isOwned = labels.find(
    //       ({ key, value }) =>
    //         key === "jobber-manager" &&
    //         value === getConfigOption("JOBBER_NAME"),
    //     );

    //     if (!isJobber || !isOwned) {
    //       return;
    //     }

    //     if (!closedRunnersContainerName.has(container.Names)) {
    //       return;
    //     }

    //     console.warn(
    //       `[RunnerManager/checkDanglingRunners] Found dangling runner container ${container.ID} (${container.Names}). Stopping...`,
    //     );

    //     await stopDockerContainer(container.ID).catch((err) => {});
    //   }),
    // );
  }

  private async processStartupQueue() {
    const queue = this.queueStartup.splice(0, this.queueStartup.length);

    // Group queue by jobId to avoid race conditions
    const queueByJobId: Record<string, RunnerManagerStartupItem[]> = {};

    for (const item of queue) {
      if (queueByJobId[item.jobId]) {
        queueByJobId[item.jobId].push(item);
      } else {
        queueByJobId[item.jobId] = [item];
      }
    }

    await Promise.all(
      Object.entries(queueByJobId).map(async ([jobId, jobQueue]) => {
        const [runnersActive, action] = await Promise.all([
          runnersModel.byJobId(jobId, {
            specialActiveIshOnly: true,
          }),
          actionsModel.byJobIdLatest(jobId),
        ]);

        const runnerMaxCount = action?.runnerMaxCount ?? Infinity;
        const runnerCurrentCount = runnersActive.length;

        let spawnAmount = jobQueue.length;

        if (spawnAmount + runnerCurrentCount >= runnerMaxCount) {
          spawnAmount = runnerMaxCount - runnerCurrentCount;
        }

        const itemsForStartup = jobQueue.slice(0, spawnAmount);
        const itemsForRequeue = jobQueue.slice(spawnAmount);

        for (const item of itemsForRequeue) {
          this.queueStartup.push(item);
        }

        await Promise.all(
          itemsForStartup.map(async (item) => {
            const result = await this.createRunner(item.jobId);

            item.startupPromise.resolve(result);
          }),
        );
      }),
    );
  }

  private async processShutdownQueue() {
    const queue = this.queueShutdown.splice(0, this.queueShutdown.length);

    await Promise.all(
      queue.map(async (item) => {
        try {
          const runner = this.runners.get(item.runnerId);

          if (!runner) {
            return;
          }

          await runnersModel.update(runner.runnerId, {
            status: "closing",
            closingAt: new Date(),
          });

          runner.promiseEvents.closing.resolve();

          if (item.method === "forceful") {
            if (runner.properties?.runnerContainerName) {
              await killDockerContainer(
                runner.properties?.runnerContainerName,
              ).catch((err) => {});
            }
          } else if (item.method === "graceful") {
            if (runner.properties?.runnerContainerName) {
              await stopDockerContainer(
                runner.properties?.runnerContainerName,
              ).catch((err) => {});
            }
          } else {
            console.warn(
              `[RunnerManager/processShutdownQueue] Unknown shutdown method ${item.method} for runner ${item.runnerId}. Defaulting to graceful.`,
            );
          }

          await runner.promiseEvents.closed.promise;
        } catch (err) {
          console.error(err);
        }
      }),
    );
  }

  private async createRunner(jobId: string): Promise<string | null> {
    let cleanupFiles: string[] = [];

    try {
      const job = await jobModel.byId(jobId);

      if (!job) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - job not found`,
        );

        return null;
      }

      if (!job.jobVersionId) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - job version not found`,
        );

        return null;
      }

      const jobVersion = await jobVersionsModel.byId(job.jobVersionId);
      assert(jobVersion, "Job version not found");

      const action = await actionsModel.byVersionId(jobVersion.id);
      assert(action, "Action not found");

      const environment = await environmentModel.byJobId(job.id);

      const image = await getImage(action.runnerImage);

      if (!image) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - image ${action.runnerImage} not found`,
        );

        return null;
      }

      if (image.status === "disabled") {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - image ${action.runnerImage} is disabled`,
        );

        return null;
      }

      if (image.status === "deprecated") {
        console.warn(
          `[RunnerManager/createRunner] Warning: creating runner for job ${jobId} with deprecated image ${action.runnerImage}`,
        );
      }

      const serviceClientRunner =
        await this.serviceClients.getSystemClientForRunner(job);

      const runnerRecord = await runnersModel.create({
        status: "starting",
        actionId: action.id,
        environmentId: environment?.id,
        jobId: job.id,
        jobVersionId: jobVersion.id,
        oauthServiceClientId: serviceClientRunner.client?.id,
      });

      if (!runnerRecord) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - failed to create runner record in database`,
        );

        return null;
      }

      const containerName = createToken({
        length: 16,
        prefix: sanitiseSafeCharacters(
          `runner-${job.jobName}-${jobVersion.version}`,
        ),
      });

      const portRandomised = Math.floor(Math.random() * 10000) + 2000;

      const runnerParameters: RunnerManagerItem["arguments"] = {
        runnerId: runnerRecord.id,

        runnerClientId: serviceClientRunner.client?.clientId ?? "",
        runnerClientSecret: serviceClientRunner.secret,
        runnerGeneralApiEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("MANAGER_GRPC_PORT")}`,

        runnerOAuthTokenEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("API_PORT")}/oauth/token`,
        runnerOAuthJwksEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("API_PORT")}/.well-known/jwks.json`,
        runnerOAuthIssuer: getConfigOption("OAUTH_ISSUER"),

        runnerApiPort: portRandomised,

        runnerDebug: getConfigOption("DEBUG_RUNNER"),
      };

      const args: string[] = [];

      args.push("run", "--rm", "--name", containerName);
      args.push("-p", `${portRandomised}:${portRandomised}`); // TODO: remove, was for testing

      args.push("--label", "jobber=true");
      args.push("--label", `jobber-manager=${getConfigOption("JOBBER_NAME")}`);
      args.push("--label", `jobber-version=${jobVersion.version}`);

      const dockerNetwork = getConfigOption("RUNNER_CONTAINER_DOCKER_NETWORK");
      if (dockerNetwork) {
        args.push("--network", dockerNetwork);
      }

      const environmentFileLines: string[] = [
        `# Job ${JSON.stringify(job.jobName)}`,
        "",
        "# System Defined Environment Variables - DO NOT MODIFY",
        `RUNNER_ID=${runnerParameters.runnerId}`,
        `RUNNER_CLIENT_ID=${runnerParameters.runnerClientId}`,
        `RUNNER_CLIENT_SECRET=${runnerParameters.runnerClientSecret}`,
        `RUNNER_GENERAL_API_ENDPOINT=${runnerParameters.runnerGeneralApiEndpoint}`,
        `RUNNER_OAUTH_TOKEN_ENDPOINT=${runnerParameters.runnerOAuthTokenEndpoint}`,
        `RUNNER_OAUTH_JWKS_ENDPOINT=${runnerParameters.runnerOAuthJwksEndpoint}`,
        `RUNNER_OAUTH_ISSUER=${runnerParameters.runnerOAuthIssuer}`,
        `RUNNER_API_PORT=${runnerParameters.runnerApiPort}`,
        `RUNNER_DEBUG=${runnerParameters.runnerDebug ? "true" : "false"}`,
      ];

      if (environment) {
        environmentFileLines.push("");
        environmentFileLines.push("");
        environmentFileLines.push(`# User defined environment variables`);
        for (const [name, { value }] of Object.entries(environment.context)) {
          environmentFileLines.push(
            `${name.toUpperCase()}=${JSON.stringify(value)}`,
          );
        }
      }

      // TODO: if fails, fallback to the old insecure strategy
      const environmentFilePath = getRunnerEnvFile(runnerRecord);
      await writeFile(environmentFilePath, environmentFileLines.join("\n"));
      cleanupFiles.push(environmentFilePath);

      args.push("--env-file", environmentFilePath);

      const actionArgumentsEnabled = getConfigOption(
        "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES",
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
            `${volume.source}:${volume.target}:${volume.mode}`,
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
        // TODO: if environment file fails, fallback to this.
        // `--runner-id=${runnerParameters.runnerId}`,
        // `--client-id=${runnerParameters.runnerClientId}`,
        // `--client-secret=${runnerParameters.runnerClientSecret}`,
        // `--general-api-endpoint=${runnerParameters.runnerGeneralApiEndpoint}`,
        // `--oauth-token-endpoint=${runnerParameters.runnerOAuthTokenEndpoint}`,
        // `--oauth-jwks-endpoint=${runnerParameters.runnerOAuthJwksEndpoint}`,
        // `--oauth-issuer=${runnerParameters.runnerOAuthIssuer}`,
        // `--port=${runnerParameters.runnerApiPort}`,
        // `--debug=${runnerParameters.runnerDebug ? "true" : "false"}`,
      );

      // NOTE: !!!! NEVER ENABLE SHELL=TRUE !!!!
      const process = spawn("docker", args, {
        windowsHide: true,
        stdio: "pipe",
      });
      // NOTE: !!!! NEVER ENABLE SHELL=TRUE !!!!

      process.once("exit", async (code) => {
        await runnersModel.update(runnerRecord.id, {
          status: "closed",
          closedAt: new Date(),
        });

        const runner = this.runners.get(runnerRecord.id);

        if (!runner) {
          return;
        }

        runner.promiseEvents.closed.resolve();

        this.runners.delete(runnerRecord.id);
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

      const tokenResult = await this.serviceClients.generateTokenForServer(
        getOAuthAudienceRunnerApi(runnerRecord.id),
      );

      const metadata = Metadata({
        Authorization: `Bearer ${tokenResult.jwt}`,
      });

      // const channel = createChannel(
      //   `${containerName}:${properties.runnerApiPort}`,
      // );
      const channel = createChannel(
        `192.168.10.200:${runnerParameters.runnerApiPort}`,
      );
      const grpc = createClientFactory().create(RunnerAPIDefinition, channel, {
        "*": {
          metadata,
        },
      }) as Client<RunnerAPIDefinition>;

      const properties = {
        runnerApiPort: runnerParameters.runnerApiPort,
        runnerContainerName: containerName,
        runnerContainerNetworks: action.runnerDockerArguments.networks ?? [],
        runnerDebug: runnerParameters.runnerDebug,
        runnerPid: process.pid?.toString() ?? "",
      };

      const promiseEvents = {
        ready: deferred<void>(),
        closing: deferred<void>(),
        closed: deferred<void>(),
      };

      this.runners.set(runnerRecord.id, {
        runnerId: runnerRecord.id,

        job,
        jobVersion,
        jobAction: action,
        environment: environment ?? null,

        process,
        properties,
        arguments: runnerParameters,

        grpcToken: tokenResult.jwt,
        grpcTokenExpiry: Math.floor(tokenResult.expiration.getTime() / 1000),
        grpcMetadata: metadata,
        grpcChannel: channel,
        grpc: grpc,

        promiseEvents,

        createdAt: getUnixTimestamp(),
      });

      await runnersModel.update(runnerRecord.id, {
        properties,
      });

      // A simple hack to wait for runner to be ready, main loop is blocked
      setImmediate(async () => {
        for (let i = 0; i < 250; i++) {
          const runner = this.runners.get(runnerRecord.id);

          if (!runner) {
            break;
          }

          if (runner.lastStatus?.status === "READY") {
            break;
          }

          await this.updateRunnerStatus(runnerRecord.id);

          // gradually sleep longer, try not to thrash the EventLoop
          if (i > 200) {
            await timeout(250);
          } else if (i > 100) {
            await timeout(100);
          } else {
            await timeout(50);
          }
        }
      });

      // Await until process opens... or fails to open
      await Promise.any([
        timeout(120_000), // Timeout after 2 minutes
        promiseEvents.ready.promise,
        promiseEvents.closing.promise,
        promiseEvents.closed.promise,
      ]);

      console.log(
        `[RunnerManager/createRunner] Runner for job ${shortenString(job.jobName, 16)} (${shortenString(job.id, 5)}) version ${jobVersion.version} created with runner id ${shortenString(runnerRecord.id, 4)}`,
      );

      return runnerRecord.id;
    } catch (err) {
      console.error(err);

      return null;
    } finally {
      for (const filePath of cleanupFiles) {
        await unlink(filePath).catch(() => {});
      }
    }
  }

  public startupQueueAdd(jobId: string) {
    const startupPromise = deferred<string | null>();

    this.queueStartup.push({
      jobId,
      startupPromise,
    });

    return startupPromise.promise;
  }

  /**
   * Gets a runner. If its a RUN_ONCE runner, it will return a new runner.
   * If its a runner compatible with a standard mode, it will return any available.
   */
  public async getRunner(jobId: string): Promise<string | null> {
    const action = await actionsModel.byJobIdLatest(jobId);

    if (!action) {
      return null;
    }

    if (action.runnerMode === "run-once") {
      return this.startupQueueAdd(jobId);
    }

    if (action.runnerMode === "standard") {
      const runners = await runnersModel.byJobId(jobId, {
        specialActiveIshOnly: true,
      });

      if (runners.length >= 1) {
        // yolo the first one back, should probs make it random but ohwell
        return runners[0].id;
      }

      const existingQueueItem = this.queueStartup.find(
        (item) => item.jobId === action.jobId,
      );

      if (existingQueueItem) {
        // avoid requeueing a standard request, this will remove the risk of a huge backlog of
        // runners.. in theory. Who knows, race conditions can be painful. Worst case this becomes
        // a DOS vector.
        // TODO: When e2e tests are figured out, add a test for this.
        return existingQueueItem.startupPromise.promise;
      }

      // no runner found, start new one.
      return this.startupQueueAdd(jobId);
    }

    return null;
  }

  public shutdownQueueAdd(runnerId: string, forceful: boolean = false) {
    const queueItem = this.queueShutdown.find(
      (item) => item.runnerId === runnerId,
    );

    if (queueItem) {
      queueItem.method = forceful ? "forceful" : "graceful";
    } else {
      this.queueShutdown.push({
        runnerId,
        method: forceful ? "forceful" : "graceful",
      });
    }
  }

  public async eventSchedule(
    runnerId: string,
    trigger: EventScheduleRequest,
  ): Promise<EventScheduleResponse> {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      throw new Error(`Runner ${runnerId} not found`);
    }

    if (!runner.grpc) {
      throw new Error(`Runner ${runnerId} gRPC client not initialized`);
    }

    try {
      const response = await runner.grpc.eventSchedule(trigger);

      return response;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public async eventMqtt(
    runnerId: string,
    trigger: EventMqttRequest,
  ): Promise<EventMqttResponse> {
    const runner = this.runners.get(runnerId);

    if (!runner) {
      throw new Error(`Runner ${runnerId} not found`);
    }

    if (!runner.grpc) {
      throw new Error(`Runner ${runnerId} gRPC client not initialized`);
    }

    try {
      const response = await runner.grpc.eventMqtt(trigger);

      return response;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
