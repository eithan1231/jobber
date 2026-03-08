import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { jobVersionsModel } from "~/db/job-versions.js";
import { mapGrpcJobVersion } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobVersion: ServiceImplementation<GeneralAPIDefinition>["getJobVersion"] =
  authorizedCall(async (request, _context, bouncer) => {
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
  });
