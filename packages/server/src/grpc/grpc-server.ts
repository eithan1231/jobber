import { ServerCredentials } from "@grpc/grpc-js";
import { createServer, Server, ServiceImplementation } from "nice-grpc";
import {
  ServerReflection,
  ServerReflectionService,
} from "nice-grpc-server-reflection";
import { readFile } from "node:fs/promises";
import { singleton } from "tsyringe";

import { LoopBase } from "@jobber/common";
import { GeneralAPIDefinition } from "@jobber/grpc/general.js";

import { getConfigOption } from "~/config.js";

import { createRunner } from "./methods/create-runner.js";
import { deleteStoreItem } from "./methods/delete-store-item.js";
import { getJobActionLatest } from "./methods/get-job-action-latest.js";
import { getJobAction } from "./methods/get-job-action.js";
import { getJobActions } from "./methods/get-job-actions.js";
import { getJobTriggers } from "./methods/get-job-trigger-.js";
import { getJobTriggersLatest } from "./methods/get-job-trigger-latest.js";
import { getJobTrigger } from "./methods/get-job-trigger.js";
import { getJobVersionArchive } from "./methods/get-job-version-archive.js";
import { getJobVersionLatest } from "./methods/get-job-version-latest.js";
import { getJobVersion } from "./methods/get-job-version.js";
import { getJobVersions } from "./methods/get-job-versions.js";
import { getJob } from "./methods/get-job.js";
import { getJobs } from "./methods/get-jobs.js";
import { getRunner } from "./methods/get-runner.js";
import { getRunners } from "./methods/get-runners.js";
import { getStoreItem } from "./methods/get-store-item.js";
import { publishMqttMessage } from "./methods/publish-mqtt-message.js";
import { setStoreItem } from "./methods/set-store-item.js";

const generalApiDefinition: ServiceImplementation<GeneralAPIDefinition> = {
  getJob: getJob,

  getJobs: getJobs,

  getJobAction: getJobAction,

  getJobActionLatest: getJobActionLatest,

  getJobActions: getJobActions,

  getJobTrigger: getJobTrigger,

  getJobTriggers: getJobTriggers,

  getJobTriggersLatest: getJobTriggersLatest,

  getJobVersion: getJobVersion,

  getJobVersionLatest: getJobVersionLatest,

  getJobVersions: getJobVersions,

  getJobVersionArchive: getJobVersionArchive,

  getRunner: getRunner,

  getRunners: getRunners,

  createRunner: createRunner,

  getStoreItem: getStoreItem,

  setStoreItem: setStoreItem,

  deleteStoreItem: deleteStoreItem,

  publishMqttMessage: publishMqttMessage,
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
