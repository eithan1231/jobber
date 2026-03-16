import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { runnersModel } from "~/db/runners.js";
import { mapGrpcJobRunner } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";
import { container } from "tsyringe";
import { RunnerManager } from "~/jobber/runners/manager.js";

export const deleteRunner: ServiceImplementation<GeneralAPIDefinition>["deleteRunner"] =
  authorizedCall(async (request, _context, bouncer) => {
    const runner = await runnersModel.byId(request.runnerId);

    if (!runner) {
      throw new ServerError(Status.NOT_FOUND, "Runner not found");
    }

    if (!bouncer.canDeleteJobRunners({ id: runner.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const manager = container.resolve(RunnerManager);

    manager.shutdownQueueAdd(runner.id, false);

    return {
      runner: mapGrpcJobRunner(runner),
    };
  });
