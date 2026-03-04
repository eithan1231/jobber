import assert from "assert";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { and, eq, isNotNull } from "drizzle-orm";
import { container, inject, singleton } from "tsyringe";

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
import {
  getDockerContainers,
  pullDockerImage,
  stopDockerContainer,
} from "~/docker.js";
import { LoopBase, awaitTruthy, timeout } from "@jobber/common";
import {
  counterRunnerRequests,
  gaugeActiveRunners,
  histogramJobManagerLoopDuration,
  histogramRunnerRequestDuration,
  histogramRunnerShutdownDuration,
  histogramRunnerStartupDuration,
} from "~/metrics.js";
import {
  createBenchmark,
  createToken,
  getUnixTimestamp,
  sanitiseSafeCharacters,
  shortenString,
} from "~/util.js";
import { getImage, getImages } from "../images.js";
import { LogDriverBase } from "../log-drivers/abstract.js";
import { Store } from "../store.js";
import {
  Channel,
  Client,
  ClientError,
  createChannel,
  createClientFactory,
  Metadata,
  Status,
} from "nice-grpc";
import {
  RunnerAPIDefinition,
  RunnerAPIServiceImplementation,
  StatusResponse,
} from "@jobber/grpc/runner.js";
import { jobModel } from "~/db/job.js";
import { jobVersionsModel } from "~/db/job-versions.js";
import { actionsModel } from "~/db/actions.js";
import { environmentModel } from "~/db/environment.js";
import { runnersModel } from "~/db/runners.js";
import { OAuthServiceClients } from "~/service-clients.js";
import {
  getOAuthAudienceGeneralApi,
  getOAuthAudienceRunnerApi,
} from "@jobber/common/oauth.js";
import { RunnersTableType } from "~/db/schema/runners.js";

type CurrentVersionResult = {
  version: JobVersionsTableType;
  job: JobsTableType;
  action: ActionsTableType;
  environment: EnvironmentsTableType | null;
};

type RunnerManagerItem = {
  status: "starting" | "ready" | "closing" | "closed";

  runnerId: string;

  job: JobsTableType;
  jobVersion: JobVersionsTableType;
  jobAction: ActionsTableType;
  environment: EnvironmentsTableType | null;

  process: ChildProcessWithoutNullStreams;

  properties?: RunnersTableType["properties"];

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

  createdAt: number;
  readyAt?: number;
  closingAt?: number;
  closedAt?: number;
};

type RunnerManagerStartupItem = {
  jobId: string;
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
    @inject(Store) private store: Store,
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

    await Promise.all([
      this.processStartupQueue(),
      this.processShutdownQueue(),
    ]);
  }

  protected async loopStarted(): Promise<void> {
    //
  }

  protected async loopClosed(): Promise<void> {
    for (const runner of this.runners.values()) {
      this.queueShutdown.push({
        runnerId: runner.arguments.runnerId,
        method: "graceful",
      });
    }

    await this.processShutdownQueue();
  }

  private async updateRunnerStatus(runnerId: string) {
    try {
      const runner = this.runners.get(runnerId);

      if (!runner) {
        return;
      }

      if (!runner.grpc) {
        return;
      }

      if (runner.process.killed) {
        // Cleanup is handled in process 'exit' event.
        return;
      }

      if (
        runner.grpcTokenExpiry &&
        getUnixTimestamp() > runner.grpcTokenExpiry - 60
      ) {
        // Token is expired or about to expire in the next 60 seconds, generate a new one
        const serviceClients = container.resolve(OAuthServiceClients);

        const tokenResult = await serviceClients.generateTokenForServer(
          getOAuthAudienceRunnerApi(runnerId),
        );

        runner.grpcMetadata.set("Authorization", `Bearer ${tokenResult.jwt}`);
        runner.grpcToken = tokenResult.jwt;
        runner.grpcTokenExpiry = Math.floor(
          tokenResult.expiration.getTime() / 1000,
        );
      }

      try {
        const status = await runner.grpc.status({});

        runner.lastStatus = status;

        if (status.status === "READY") {
          runner.status = "ready";
          runner.readyAt = getUnixTimestamp();

          await runnersModel.update(runner.runnerId, {
            status: "ready",
            readyAt: new Date(runner.readyAt * 1000),
          });
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

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Check if its running the expected version
    if (runner.jobVersion.id !== currentVersion.version.id) {
      // Send shutdown

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Check max age
    if (
      runner.jobAction.runnerMaxAge &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAge
    ) {
      // Send shutdown

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Check hard max age
    if (
      runner.jobAction.runnerMaxAgeHard &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAgeHard
    ) {
      // Send shutdown

      this.queueShutdown.push({
        runnerId,
        method: "forceful",
      });

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

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Environment Changes - runner started without environment, but now has one
    if (!runner.environment && currentVersion.environment) {
      // Send shutdown - environment added

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Environment Changes - runner started with environment, but now doesn't have one
    if (runner.environment && !currentVersion.environment) {
      // Send shutdown - environment removed

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

      return;
    }

    // Environment Changes - runner started with environment, but it has been modified
    if (
      runner.environment &&
      currentVersion.environment &&
      runner.environment.modified !== currentVersion.environment.modified
    ) {
      // Send shutdown - environment modified

      this.queueShutdown.push({
        runnerId,
        method: "graceful",
      });

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
        this.queueStartup.push({
          jobId: job.id,
        });
      }
    }
  }

  private async checkDanglingRunners() {
    //
    const containers = await getDockerContainers();

    for (const container of containers) {
      const labels = container.Labels.split(",").map((label) => {
        const parts = label.split("=", 2);

        return {
          key: parts.at(0) ?? "",
          value: parts.at(1) ?? "",
        };
      });

      const isJobber = labels.find(
        ({ key, value }) => key === "jobber" && value === "true",
      );

      const isOwned = labels.find(
        ({ key, value }) =>
          key === "jobber-manager" && value === getConfigOption("JOBBER_NAME"),
      );

      if (!isJobber || !isOwned) {
        continue;
      }

      let isRunnerKnown = false;

      for (const runner of this.runners.values()) {
        if (runner.properties?.runnerContainerName === container.Names) {
          isRunnerKnown = true;
          break;
        }
      }

      if (isRunnerKnown) {
        continue;
      }

      // TODO: Possibly regain ownership of the runner?

      console.log(Array.from(this.runners.keys()));
      console.warn(
        `[RunnerManager/checkDanglingRunners] Found dangling runner container ${container.ID} (${container.Names}). Stopping...`,
      );

      // Runner is not known, at least by this manager instance.
      await stopDockerContainer(container.ID);

      console.warn(
        `[RunnerManager/checkDanglingRunners] Stopped dangling runner container ${container.ID} (${container.Names}).`,
      );
    }
  }

  private async processStartupQueue() {
    const queue = this.queueStartup.splice(0, this.queueStartup.length);

    await Promise.all(
      queue.map(async (item) => {
        await this.createRunner(item.jobId);
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

          runner.status = "closing";
          runner.closingAt = getUnixTimestamp();

          await runnersModel.update(runner.runnerId, {
            status: "closing",
            closingAt: new Date(runner.closingAt * 1000),
          });

          if (item.method === "forceful") {
            runner.process.kill("SIGTERM");
          }

          if (item.method === "graceful") {
            runner.process.kill("SIGKILL");
          }
        } catch (err) {
          console.error(err);
        }
      }),
    );
  }

  private async createRunner(jobId: string) {
    try {
      const job = await jobModel.byId(jobId);

      if (!job) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - job not found`,
        );

        return;
      }

      if (!job.jobVersionId) {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - job version not found`,
        );

        return;
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

        return;
      }

      if (image.status === "disabled") {
        console.warn(
          `[RunnerManager/createRunner] Failed to create runner for job ${jobId} - image ${action.runnerImage} is disabled`,
        );

        return;
      }

      if (image.status === "deprecated") {
        console.warn(
          `[RunnerManager/createRunner] Warning: creating runner for job ${jobId} with deprecated image ${action.runnerImage}`,
        );
      }

      // Create OAuth client
      const serviceClients = container.resolve(OAuthServiceClients);

      // TODO: Set Expiry
      const serviceClientRunner =
        await serviceClients.getSystemClientForRunner(job);

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

        return;
      }

      const containerName = createToken({
        length: 16,
        prefix: sanitiseSafeCharacters(
          `runner-${job.jobName}-${jobVersion.version}`,
        ),
      });

      const args: string[] = [];

      const removeMePort =
        Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;

      args.push("run", "--rm", "--name", containerName);
      args.push("-p", `${removeMePort}:${removeMePort}`); // TODO: remove, was for testing

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

      const runnerParameters: RunnerManagerItem["arguments"] = {
        runnerId: runnerRecord.id,

        runnerClientId: serviceClientRunner.client?.clientId ?? "",
        runnerClientSecret: serviceClientRunner.secret,
        runnerGeneralApiEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("MANAGER_GRPC_PORT")}`,

        runnerOAuthTokenEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("API_PORT")}/oauth/token`,
        runnerOAuthJwksEndpoint: `http://${getConfigOption("MANAGER_HOST")}:${getConfigOption("API_PORT")}/.well-known/jwks.json`,
        runnerOAuthIssuer: getConfigOption("OAUTH_ISSUER"),

        runnerApiPort: removeMePort,

        runnerDebug: getConfigOption("DEBUG_RUNNER"),
      };

      args.push(
        image.imageUrl,
        "node",
        ENTRYPOINT_NODE,
        `--runner-id=${runnerParameters.runnerId}`,
        `--client-id=${runnerParameters.runnerClientId}`,
        `--client-secret=${runnerParameters.runnerClientSecret}`,
        `--general-api-endpoint=${runnerParameters.runnerGeneralApiEndpoint}`,
        `--oauth-token-endpoint=${runnerParameters.runnerOAuthTokenEndpoint}`,
        `--oauth-jwks-endpoint=${runnerParameters.runnerOAuthJwksEndpoint}`,
        `--oauth-issuer=${runnerParameters.runnerOAuthIssuer}`,
        `--port=${runnerParameters.runnerApiPort}`,
        `--debug=${runnerParameters.runnerDebug ? "true" : "false"}`,
      );

      const process = spawn("docker", args, {
        windowsHide: true,
        stdio: "pipe",
      });

      process.once("exit", async (code) => {
        await runnersModel.update(runnerRecord.id, {
          status: "closed",
          closedAt: new Date(),
        });

        this.runners.delete(runnerRecord.id);
      });

      process.stderr.on("data", (buffer: Buffer) => {
        console.log(buffer.toString());

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
        console.log(buffer.toString());
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

      const tokenResult = await serviceClients.generateTokenForServer(
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

      this.runners.set(runnerRecord.id, {
        status: "starting",

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

        createdAt: getUnixTimestamp(),
      });

      await runnersModel.update(runnerRecord.id, {
        properties,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
