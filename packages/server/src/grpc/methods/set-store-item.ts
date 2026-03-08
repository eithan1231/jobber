import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { jobModel } from "~/db/job.js";
import { storeModel } from "~/db/store.js";
import { getUnixTimestamp } from "~/util.js";
import { authorizedCall } from "../util.js";

export const setStoreItem: ServiceImplementation<GeneralAPIDefinition>["setStoreItem"] =
  authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canWriteJobStore({ jobId: request.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const expiry = request.ttl ? getUnixTimestamp() + request.ttl : undefined;

    const storeItem = await storeModel.upsert({
      jobId: request.jobId,
      storeKey: request.key,
      storeValue: request.value,
      expiry: expiry,
    });

    if (!storeItem) {
      throw new ServerError(Status.INTERNAL, "Failed to set store item");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  });
