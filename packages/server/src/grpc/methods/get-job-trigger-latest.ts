import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { jobModel } from "~/db/job.js";
import { triggersModel } from "~/db/triggers.js";
import { mapGrpcTrigger } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobTriggersLatest: ServiceImplementation<GeneralAPIDefinition>["getJobTriggersLatest"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
