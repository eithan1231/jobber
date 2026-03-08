import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { jobModel } from "~/db/job.js";
import { mapGrpcJob } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJob: ServiceImplementation<GeneralAPIDefinition>["getJob"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
