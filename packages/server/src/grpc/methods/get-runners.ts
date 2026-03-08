import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { runnersModel } from "~/db/runners.js";
import { mapGrpcJobRunner } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getRunners: ServiceImplementation<GeneralAPIDefinition>["getRunners"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
