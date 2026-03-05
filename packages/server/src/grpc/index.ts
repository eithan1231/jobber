import { ServerCredentials } from "@grpc/grpc-js";
import { LoopBase } from "@jobber/common";
import { BouncerBase } from "@jobber/common/bouncer-base.js";
import { JobberPermissionsSchema } from "@jobber/common/permissions.js";
import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { createLocalJWKSet, errors as joseErrors, jwtVerify } from "jose";
import {
  CallContext,
  createServer,
  Server,
  ServerError,
  ServiceImplementation,
  Status,
} from "nice-grpc";
import {
  ServerReflection,
  ServerReflectionService,
} from "nice-grpc-server-reflection";
import { open, readFile } from "node:fs/promises";
import { container, singleton } from "tsyringe";

import { getOAuthAudienceGeneralApi } from "@jobber/common/oauth.js";
import * as grpcAction from "@jobber/grpc/basics/action.js";
import * as grpcJobVersion from "@jobber/grpc/basics/job-version.js";
import * as grpcJob from "@jobber/grpc/basics/job.js";
import * as grpcRunner from "@jobber/grpc/basics/runner.js";
import * as grpcTrigger from "@jobber/grpc/basics/trigger.js";

import { getConfigOption } from "~/config.js";
import { actionsModel } from "~/db/actions.js";
import { jobVersionsModel } from "~/db/job-versions.js";
import { jobModel } from "~/db/job.js";
import { runnersModel } from "~/db/runners.js";
import { storeModel } from "~/db/store.js";
import { triggersModel } from "~/db/triggers.js";
import { TriggerMqtt } from "~/jobber/triggers/mqtt.js";
import { getJobActionArchiveFile } from "~/paths.js";
import { OAuthServiceClients } from "~/service-clients.js";
import { OAuthSigningKeys } from "~/signing-keys.js";
import { getUnixTimestamp } from "~/util.js";
import {
  ActionsTableType,
  JobsTableType,
  JobVersionsTableType,
  RunnersTableType,
  TriggersTableType,
} from "~/db/types.js";

const authorizedCall = <TRequest, TResponse>(
  callback: (
    request: TRequest,
    context: CallContext,
    bouncer: BouncerBase,
  ) => Promise<TResponse>,
) => {
  return async (
    request: TRequest,
    context: CallContext,
  ): Promise<TResponse> => {
    return callback(request, context, await getBouncer(context));
  };
};

const getBouncer = async (context: CallContext) => {
  try {
    const oauthSigningKeys = container.resolve(OAuthSigningKeys);
    const oauthServiceClients = container.resolve(OAuthServiceClients);

    let token = context.metadata.get("Authorization");

    if (!token) {
      console.log("gRPC Unauthorized error: No token provided");
      throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice("Bearer ".length);
    }

    const jwks = createLocalJWKSet(await oauthSigningKeys.createJwksSet());

    const { payload } = await jwtVerify(token, jwks, {
      issuer: getConfigOption("OAUTH_ISSUER"),
      audience: getOAuthAudienceGeneralApi(),
    });

    const permissions = await JobberPermissionsSchema.parseAsync(
      payload.permissions,
    );

    const bouncer = new BouncerBase(permissions);

    return bouncer;
  } catch (err) {
    if (err instanceof ServerError) {
      throw err;
    }

    if (err instanceof joseErrors.JOSEError) {
      console.log("gRPC Unauthorized error:", err);
      throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
    }

    console.log("gRPC Internal server error:", err);
    throw new ServerError(Status.INTERNAL, "Internal server error");
  }
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

const mapGrpcJobRunner = (runner: RunnersTableType): grpcRunner.Item => {
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

const generalApiDefinition: ServiceImplementation<GeneralAPIDefinition> = {
  getJob: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (bouncer.canReadJob(job)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      job: mapGrpcJob(job),
    };
  }),

  getJobs: authorizedCall(async (_request, _context, bouncer) => {
    const jobs = (await jobModel.all())
      .map(mapGrpcJob)
      .filter((job) => bouncer.canReadJob(job));

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
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      action: mapGrpcAction(action),
    };
  }),

  getJobActionLatest: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job || !job.jobVersionId) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    const action = await actionsModel.byVersionId(job.jobVersionId);

    if (!action) {
      throw new ServerError(Status.NOT_FOUND, "Action not found");
    }

    if (action.jobId !== request.jobId) {
      throw new ServerError(Status.NOT_FOUND, "Action not found");
    }

    if (!bouncer.canReadJobAction(action)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
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
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
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

  getJobTriggersLatest: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job || !job.jobVersionId) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    const triggers = (
      await triggersModel.all({
        jobId: request.jobId,
        jobVersionId: job.jobVersionId,
      })
    )
      .filter((trigger) => {
        if (trigger.jobId !== request.jobId) {
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
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      jobVersion: mapGrpcJobVersion(jobVersion),
    };
  }),

  getJobVersionLatest: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job || !job.jobVersionId) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    const jobVersion = await jobVersionsModel.byId(job.jobVersionId);

    if (!jobVersion) {
      throw new ServerError(Status.NOT_FOUND, "Job version not found");
    }

    if (!bouncer.canReadJobVersion(jobVersion)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
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

  async *getJobVersionArchive(request, context) {
    const bouncer = await getBouncer(context);

    const [jobVersion, jobAction] = await Promise.all([
      jobVersionsModel.byId(request.jobVersionId),
      actionsModel.byVersionId(request.jobVersionId),
    ]);

    if (!jobVersion || !jobAction) {
      throw new ServerError(Status.NOT_FOUND, "Job version not found");
    }

    if (!bouncer.canReadJobVersionArchive(jobVersion)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const archiveFileName = getJobActionArchiveFile(jobVersion, jobAction);

    const handle = await open(archiveFileName, "r");
    const chunkSize = 1024 * 10;

    try {
      for (let seq = 0; ; seq++) {
        const position = seq * chunkSize;

        const buffer = Buffer.alloc(chunkSize);

        const { bytesRead } = await handle.read({
          buffer,
          length: chunkSize,
          position,
        });

        if (bytesRead === 0) {
          break;
        }

        yield {
          seq,
          data: buffer.subarray(0, bytesRead),
          end: bytesRead < chunkSize,
        };

        if (bytesRead < chunkSize) {
          break;
        }
      }
    } finally {
      await handle.close();
    }
  },

  getRunner: authorizedCall(async (request, _context, bouncer) => {
    const runner = await runnersModel.byId(request.runnerId);

    if (!runner) {
      throw new ServerError(Status.NOT_FOUND, "Runner not found");
    }

    if (!bouncer.canReadJobRunners({ id: runner.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      runner: mapGrpcJobRunner(runner),
    };
  }),

  getRunners: authorizedCall(async (request, _context, bouncer) => {
    const runners = await runnersModel.all();

    if (!runners) {
      throw new ServerError(Status.NOT_FOUND, "Runner not found");
    }

    const filteredRunners = runners.filter((runner) => {
      if (request.jobId && runner.jobId !== request.jobId) {
        return false;
      }

      if (request.versionId && runner.jobVersionId !== request.versionId) {
        return false;
      }

      if (request.actionId && runner.actionId !== request.actionId) {
        return false;
      }

      if (
        request.status &&
        runner.status.toLowerCase() !== request.status.toLowerCase()
      ) {
        return false;
      }

      return bouncer.canReadJobRunners({ id: runner.jobId });
    });

    return {
      runners: filteredRunners.map((runner) => mapGrpcJobRunner(runner)),
    };
  }),

  getStoreItem: authorizedCall(async (request, _context, bouncer) => {
    const storeItem = await storeModel.byKey(request.jobId, request.key);

    if (!storeItem) {
      throw new ServerError(Status.NOT_FOUND, "Store item not found");
    }

    if (!bouncer.canReadJobStore(storeItem)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  }),

  setStoreItem: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canWriteJobStore({ jobId: request.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const expiry = request.ttl ? getUnixTimestamp() + request.ttl : undefined;

    const storeItem = await storeModel.upsert({
      jobId: request.jobId,
      storeKey: request.key,
      storeValue: request.value,
      expiry: expiry,
    });

    if (!storeItem) {
      throw new ServerError(Status.INTERNAL, "Failed to set store item");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  }),

  deleteStoreItem: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canDeleteJobStore({ jobId: request.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const storeItem = await storeModel.deleteByKey(request.jobId, request.key);

    if (!storeItem) {
      throw new ServerError(Status.NOT_FOUND, "Store item not found");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  }),

  publishMqttMessage: authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canPublishMqttMessage(job)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const triggerMqtt = container.resolve(TriggerMqtt);

    await triggerMqtt.publishMqttMessage(
      job.id,
      request.topic,
      Buffer.from(request.payload),
    );

    return {};
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

    this.server.add(
      ServerReflectionService,
      ServerReflection(await readFile("../grpc/src/protoset.bin"), [
        GeneralAPIDefinition.fullName,
      ]),
    );

    await this.server.listen(
      `${getConfigOption("MANAGER_GRPC_BIND_ADDRESS")}:${getConfigOption(
        "MANAGER_GRPC_PORT",
      )}`,
      ServerCredentials.createInsecure(),
    );
  }

  protected async loopClosing() {
    await this.server?.shutdown();
  }

  protected async loopIteration() {}
}
