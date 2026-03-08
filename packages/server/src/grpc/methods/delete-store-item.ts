import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { jobModel } from "~/db/job.js";
import { storeModel } from "~/db/store.js";
import { authorizedCall } from "../util.js";

export const deleteStoreItem: ServiceImplementation<GeneralAPIDefinition>["deleteStoreItem"] =
  authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canDeleteJobStore({ jobId: request.jobId })) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const storeItem = await storeModel.deleteByKey(request.jobId, request.key);

    if (!storeItem) {
      throw new ServerError(Status.NOT_FOUND, "Store item not found");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  });
