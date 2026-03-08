import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServiceImplementation } from "nice-grpc";
import { jobVersionsModel } from "~/db/job-versions.js";
import { mapGrpcJobVersion } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobVersions: ServiceImplementation<GeneralAPIDefinition>["getJobVersions"] =
  authorizedCall(async (request, _context, bouncer) => {
    const jobVersions = (await jobVersionsModel.all({ jobId: request.jobId }))
      .filter((jobVersion) => {
        if (jobVersion.jobId !== request.jobId) {
          return false;
        }

        return bouncer.canReadJobVersion(jobVersion);
      })
      .map(mapGrpcJobVersion);

    return {
      jobVersions,
    };
  });
