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

type CurrentVersionResult = {
  version: JobVersionsTableType;
  job: JobsTableType;
  action: ActionsTableType;
  environment: EnvironmentsTableType | null;
};

type RunnerManagerItem = {
  status: "starting" | "ready" | "closing" | "closed";

  job: JobsTableType;
  jobVersion: JobVersionsTableType;
  jobAction: ActionsTableType;
  environment: EnvironmentsTableType | null;

  process: ChildProcessWithoutNullStreams;

  properties: {
    runnerId: string;

    runnerClientId: string;
    runnerClientSecret: string;
    runnerGeneralApiEndpoint: string;

    runnerOAuthTokenEndpoint: string;
    runnerOAuthJwksEndpoint: string;
    runnerOAuthIssuer: string;
    runnerOAuthAudience: string;

    runnerApiPort: number;

    runnerDebug: boolean;
  };

  lastRequestAt?: number;

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

    await Promise.all(
      Array.from(this.runners.keys()).map((runnerId) =>
        this.checkRunner(runnerId, currentVersions),
      ),
    );
  }

  protected async loopStarted(): Promise<void> {
    //
  }

  protected async loopClosed(): Promise<void> {
    //
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

      return;
    }

    // Check if its running the expected version
    if (runner.jobVersion.id !== currentVersion.version.id) {
      // Send shutdown

      return;
    }

    // Check max age
    if (
      runner.jobAction.runnerMaxAge &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAge
    ) {
      // Send shutdown

      return;
    }

    // Check hard max age
    if (
      runner.jobAction.runnerMaxAgeHard &&
      getUnixTimestamp() > runner.createdAt + runner.jobAction.runnerMaxAgeHard
    ) {
      // Send shutdown

      return;
    }

    // Check max idle age
    if (
      runner.jobAction.runnerMaxIdleAge &&
      runner.lastRequestAt &&
      getUnixTimestamp() >
        runner.lastRequestAt + runner.jobAction.runnerMaxIdleAge
    ) {
      // Send shutdown

      return;
    }

    // Environment Changes - runner started without environment, but now has one
    if (!runner.environment && currentVersion.environment) {
      // Send shutdown - environment added

      return;
    }

    // Environment Changes - runner started with environment, but now doesn't have one
    if (runner.environment && !currentVersion.environment) {
      // Send shutdown - environment removed

      return;
    }

    // Environment Changes - runner started with environment, but it has been modified
    if (
      runner.environment &&
      currentVersion.environment &&
      runner.environment.modified !== currentVersion.environment.modified
    ) {
      // Send shutdown - environment modified

      return;
    }
  }

  private async checkScaling(currentVersion: CurrentVersionResult) {
    //
  }

  private async processStartupQueue() {
    //
  }

  private async processShutdownQueue() {
    //
  }
}
