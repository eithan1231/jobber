import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { runnersModel } from "~/db/runners.js";
import { mapGrpcJobRunner } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getRunner: ServiceImplementation<GeneralAPIDefinition>["getRunner"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
