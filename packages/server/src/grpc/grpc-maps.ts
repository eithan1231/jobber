import * as grpcAction from "@jobber/grpc/basics/action.js";
import * as grpcJobVersion from "@jobber/grpc/basics/job-version.js";
import * as grpcJob from "@jobber/grpc/basics/job.js";
import * as grpcRunner from "@jobber/grpc/basics/runner.js";
import * as grpcTrigger from "@jobber/grpc/basics/trigger.js";

import { ServerError, Status } from "nice-grpc";

import {
  ActionsTableType,
  JobsTableType,
  JobVersionsTableType,
  RunnersTableType,
  TriggersTableType,
} from "~/db/types.js";

export const mapGrpcJob = (job: JobsTableType): grpcJob.Item => {
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

export const mapGrpcAction = (action: ActionsTableType): grpcAction.Item => {
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

export const mapGrpcTrigger = (
  trigger: TriggersTableType,
): grpcTrigger.Item => {
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

export const mapGrpcJobVersion = (
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

export const mapGrpcJobRunner = (runner: RunnersTableType): grpcRunner.Item => {
  return {
    id: runner.id,
    jobId: runner.jobId,
    actionId: runner.actionId,
    versionId: runner.jobVersionId,
    properties: runner.properties
      ? {
          runnerPid: runner.properties.runnerPid,
          runnerContainerName: runner.properties.runnerContainerName,
          runnerContainerNetworks: runner.properties.runnerContainerNetworks,
          runnerApiPort: runner.properties.runnerApiPort,
          runnerDebug: runner.properties.runnerDebug,
        }
      : undefined,
    createdAt: runner.createdAt.toISOString(),
    readyAt: runner.readyAt?.toISOString() ?? undefined,
    closingAt: runner.closingAt?.toISOString() ?? undefined,
    closedAt: runner.closedAt?.toISOString() ?? undefined,
  };
};
