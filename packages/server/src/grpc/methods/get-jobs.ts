import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServiceImplementation } from "nice-grpc";
import { jobModel } from "~/db/job.js";
import { mapGrpcJob } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobs: ServiceImplementation<GeneralAPIDefinition>["getJobs"] =
  authorizedCall(async (request, _context, bouncer) => {
    const jobs = (await jobModel.all())
      .map(mapGrpcJob)
      .filter((job) => bouncer.canReadJob(job));

    return {
      jobs,
    };
  });
