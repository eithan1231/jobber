import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServiceImplementation } from "nice-grpc";
import { triggersModel } from "~/db/triggers.js";
import { mapGrpcTrigger } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobTriggers: ServiceImplementation<GeneralAPIDefinition>["getJobTriggers"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
