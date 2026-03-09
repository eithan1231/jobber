import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { container } from "tsyringe";
import { jobModel } from "~/db/job.js";
import { runnersModel } from "~/db/runners.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { mapGrpcJobRunner } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const createRunner: ServiceImplementation<GeneralAPIDefinition>["createRunner"] =
  authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (bouncer.canCreateRunner(job)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const manager = container.resolve(RunnerManager);

    const runnerId = await manager.getRunner(job.id);

    if (!runnerId) {
      throw new ServerError(Status.INTERNAL, "Failed to create runner");
    }

    const runner = await runnersModel.byId(runnerId);

    if (!runner) {
      throw new ServerError(Status.INTERNAL, "Failed to find created runner");
    }

    return {
      runner: mapGrpcJobRunner(runner),
    };
  });
