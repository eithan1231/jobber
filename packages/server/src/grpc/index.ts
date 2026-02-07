import { LoopBase } from "@jobber/common";
import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import {
  CallContext,
  createServer,
  Server,
  ServiceImplementation,
  ServerError,
  Status,
} from "nice-grpc";
import { container, singleton } from "tsyringe";
import { Bouncer } from "~/bouncer.js";
import { getConfigOption } from "~/config.js";
import { apiTokensModel } from "~/db/api-tokens.js";

import { SignJWT } from "jose";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { jobModel } from "~/db/job.js";
import * as grpcJob from "@jobber/grpc/basics/job.js";
import * as grpcAction from "@jobber/grpc/basics/action.js";
import * as grpcTrigger from "@jobber/grpc/basics/trigger.js";
import * as grpcJobVersion from "@jobber/grpc/basics/job-version.js";
import { JobsTableType } from "~/db/schema/jobs.js";
import { actionsModel } from "~/db/actions.js";
import { ActionsTableType } from "~/db/schema/actions.js";
import { TriggersTableType } from "~/db/schema/triggers.js";
import { triggersModel } from "~/db/triggers.js";
import { jobVersionsModel } from "~/db/job-versions.js";
import { JobVersionsTableType } from "~/db/schema/job-versions.js";

const authorizedCall = <TRequest, TResponse>(
  callback: (
    request: TRequest,
    context: CallContext,
    bouncer: Bouncer,
  ) => Promise<TResponse>,
) => {
  return async (
    request: TRequest,
    context: CallContext,
  ): Promise<TResponse> => {
    try {
      const token = context.metadata.get("authorization");

      if (!token) {
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      const apiToken = await apiTokensModel.byValidToken(token);

      if (!apiToken) {
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      const bouncer = new Bouncer({
        type: "token",
        token: apiToken,
        permissions: apiToken.permissions,
      });

      return callback(request, context, bouncer);
    } catch (err) {
      if (err instanceof ServerError) {
        throw err;
      }

      console.log("gRPC Internal server error:", err);
      throw new ServerError(Status.INTERNAL, "Internal server error");
    }
  };
};

const mapGrpcJob = (job: JobsTableType): grpcJob.Item => {
  let status: grpcJob.Item_Status;
  if (job.status === "enabled") {
    status = grpcJob.Item_Status.ENABLED;
  } else if (job.status === "disabled") {
    status = grpcJob.Item_Status.DISABLED;
  } else {
    throw new ServerError(Status.INTERNAL, "Unknown job status");
  }

  return {
    id: job.id,
    jobName: job.jobName,
    status: status,
    description: job.description ?? undefined,
    versionId: job.jobVersionId || undefined,
    links: job.links.map((link) => ({
      name: link.name,
      url: link.url,
    })),
  };
};

const mapGrpcAction = (action: ActionsTableType): grpcAction.Item => {
  let runnerMode: grpcAction.Item_RunnerMode;
  if (action.runnerMode === "run-once") {
    runnerMode = grpcAction.Item_RunnerMode.RUN_ONCE;
  } else if (action.runnerMode === "standard") {
    runnerMode = grpcAction.Item_RunnerMode.STANDARD;
  } else {
    throw new ServerError(Status.INTERNAL, "Unknown job status");
  }

  return {
    id: action.id,
    jobId: action.jobId,
    versionId: action.jobVersionId,

    runnerImage: action.runnerImage,
    runnerAsynchronous: action.runnerAsynchronous,
    runnerMinCount: action.runnerMinCount,
    runnerMaxCount: action.runnerMaxCount,
    runnerTimeout: action.runnerTimeout,
    runnerMaxIdleAge: action.runnerMaxIdleAge,
    runnerMaxAge: action.runnerMaxAge,
    runnerMaxAgeHard: action.runnerMaxAgeHard,

    dockerArguments: {
      networks: action.runnerDockerArguments.networks ?? [],

      volumes:
        action.runnerDockerArguments.volumes?.map((volume) => {
          let volumeMode: grpcAction.Item_DockerArguments_Volume_VolumeMode;
          if (volume.mode === "ro") {
            volumeMode =
              grpcAction.Item_DockerArguments_Volume_VolumeMode.READ_ONLY;
          } else if (volume.mode === "rw") {
            volumeMode =
              grpcAction.Item_DockerArguments_Volume_VolumeMode.READ_WRITE;
          } else {
            volumeMode =
              grpcAction.Item_DockerArguments_Volume_VolumeMode.READ_WRITE;
          }

          return {
            source: volume.source,
            target: volume.target,
            mode: volumeMode,
          };
        }) ?? [],

      labels: action.runnerDockerArguments.labels || [],

      memoryLimit: action.runnerDockerArguments.memoryLimit || undefined,

      directPassthroughArguments:
        action.runnerDockerArguments.directPassthroughArguments || [],
    },

    runnerMode: runnerMode,
  };
};

const mapGrpcTrigger = (trigger: TriggersTableType): grpcTrigger.Item => {
  return {
    id: trigger.id,
    jobId: trigger.jobId,
    versionId: trigger.jobVersionId,

    schedule:
      trigger.context.type === "schedule"
        ? {
            name: trigger.context.name ?? undefined,
            cron: trigger.context.cron,
            timezone: trigger.context.timezone ?? undefined,
          }
        : undefined,

    http:
      trigger.context.type === "http"
        ? {
            name: trigger.context.name ?? undefined,
            hostname: trigger.context.hostname ?? undefined,
            method: trigger.context.method ?? undefined,
            path: trigger.context.path ?? undefined,
          }
        : undefined,

    mqtt:
      trigger.context.type === "mqtt"
        ? {
            name: trigger.context.name ?? undefined,
            topics: trigger.context.topics,
            connection: {
              protocol: trigger.context.connection.protocol ?? undefined,
              protocolVariable:
                trigger.context.connection.protocolVariable ?? undefined,
              port: trigger.context.connection.port ?? undefined,
              portVariable:
                trigger.context.connection.portVariable ?? undefined,
              host: trigger.context.connection.host ?? undefined,
              hostVariable:
                trigger.context.connection.hostVariable ?? undefined,
              username: trigger.context.connection.username ?? undefined,
              usernameVariable:
                trigger.context.connection.usernameVariable ?? undefined,
              password: trigger.context.connection.password ?? undefined,
              passwordVariable:
                trigger.context.connection.passwordVariable ?? undefined,
              clientId: trigger.context.connection.clientId ?? undefined,
              clientIdVariable:
                trigger.context.connection.clientIdVariable ?? undefined,
            },
          }
        : undefined,
  };
};

const mapGrpcJobVersion = (
  jobVersion: JobVersionsTableType,
): grpcJobVersion.Item => {
  return {
    id: jobVersion.id,
    jobId: jobVersion.jobId,
    version: jobVersion.version,
    created: new Date(jobVersion.created * 1000).toISOString(),
    modified: new Date(jobVersion.modified * 1000).toISOString(),
  };
};

const generalApiDefinition: ServiceImplementation<GeneralAPIDefinition> = {
  getJob: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canReadJob(job)) {
      throw new ServerError(
        Status.PERMISSION_DENIED,
        "Insufficient permissions",
      );
    }

    return {
      job: mapGrpcJob(job),
    };
  }),

  getJobs: authorizedCall(async (_request, _context, bouncer) => {
    const jobs = (await jobModel.all())
      .filter(bouncer.canReadJob)
      .map(mapGrpcJob);

    return {
      jobs,
    };
  }),

  getJobAction: authorizedCall(async (request, _context, bouncer) => {
    const action = await actionsModel.byId(request.actionId);

    if (!action) {
      throw new ServerError(Status.NOT_FOUND, "Action not found");
    }

    if (action.jobId !== request.jobId) {
      throw new ServerError(Status.NOT_FOUND, "Action not found");
    }

    if (!bouncer.canReadJobAction(action)) {
      throw new ServerError(
        Status.PERMISSION_DENIED,
        "Insufficient permissions",
      );
    }

    return {
      action: mapGrpcAction(action),
    };
  }),

  getJobActions: authorizedCall(async (request, _context, bouncer) => {
    const actions = (await actionsModel.all())
      .filter((action) => {
        if (action.jobId !== request.jobId) {
          return false;
        }

        if (request.versionId && action.jobVersionId !== request.versionId) {
          return false;
        }

        return bouncer.canReadJobAction(action);
      })
      .map(mapGrpcAction);

    return {
      actions,
    };
  }),

  getJobTrigger: authorizedCall(async (request, _context, bouncer) => {
    const trigger = await triggersModel.byId(request.triggerId);

    if (!trigger) {
      throw new ServerError(Status.NOT_FOUND, "Trigger not found");
    }

    if (trigger.jobId !== request.jobId) {
      throw new ServerError(Status.NOT_FOUND, "Trigger not found");
    }

    if (!bouncer.canReadJobTriggers(trigger)) {
      throw new ServerError(
        Status.PERMISSION_DENIED,
        "Insufficient permissions",
      );
    }

    return {
      trigger: mapGrpcTrigger(trigger),
    };
  }),

  getJobTriggers: authorizedCall(async (request, _context, bouncer) => {
    const triggers = (
      await triggersModel.all({
        jobId: request.jobId,
        jobVersionId: request.versionId || undefined,
      })
    )
      .filter((trigger) => {
        if (trigger.jobId !== request.jobId) {
          return false;
        }

        if (request.versionId && trigger.jobVersionId !== request.versionId) {
          return false;
        }

        return bouncer.canReadJobTriggers(trigger);
      })
      .map(mapGrpcTrigger);

    return {
      triggers,
    };
  }),

  getJobVersion: authorizedCall(async (request, _context, bouncer) => {
    const jobVersion = await jobVersionsModel.byId(request.jobVersionId);

    if (!jobVersion) {
      throw new ServerError(Status.NOT_FOUND, "Job version not found");
    }

    if (!bouncer.canReadJobVersion(jobVersion)) {
      throw new ServerError(
        Status.PERMISSION_DENIED,
        "Insufficient permissions",
      );
    }

    return {
      jobVersion: mapGrpcJobVersion(jobVersion),
    };
  }),

  getJobVersions: authorizedCall(async (request, _context, bouncer) => {
    const jobVersions = (await jobVersionsModel.all({ jobId: request.jobId }))
      .filter((jobVersion) => {
        if (jobVersion.jobId !== request.jobId) {
          return false;
        }

        return bouncer.canReadJobVersion(jobVersion);
      })
      .map(mapGrpcJobVersion);

    return {
      jobVersions,
    };
  }),

  getRunner: authorizedCall(async (request, _context, bouncer) => {
    throw new ServerError(Status.UNIMPLEMENTED, "Not implemented");
  }),

  getRunners: authorizedCall(async (request, _context, bouncer) => {
    throw new ServerError(Status.UNIMPLEMENTED, "Not implemented");
  }),
};

@singleton()
export class GrpcServer extends LoopBase {
  protected loopDuration = 1000;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  private server: Server | null = null;

  protected async loopStarting() {
    this.server = createServer({});

    this.server.add(GeneralAPIDefinition, generalApiDefinition);

    await this.server.listen(
      `${getConfigOption("MANAGER_GRPC_BIND_ADDRESS")}:${getConfigOption(
        "MANAGER_GRPC_PORT",
      )}`,
    );
  }

  protected async loopClosing() {
    await this.server?.shutdown();
  }

  protected async loopIteration() {}
}
