import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { actionsModel } from "~/db/actions.js";
import { jobModel } from "~/db/job.js";
import { mapGrpcAction } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobActionLatest: ServiceImplementation<GeneralAPIDefinition>["getJobActionLatest"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
