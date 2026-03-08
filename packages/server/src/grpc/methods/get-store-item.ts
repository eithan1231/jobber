import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { storeModel } from "~/db/store.js";
import { authorizedCall } from "../util.js";

export const getStoreItem: ServiceImplementation<GeneralAPIDefinition>["getStoreItem"] =
  authorizedCall(async (request, _context, bouncer) => {
    const storeItem = await storeModel.byKey(request.jobId, request.key);

    if (!storeItem) {
      throw new ServerError(Status.NOT_FOUND, "Store item not found");
    }

    if (!bouncer.canReadJobStore(storeItem)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      key: storeItem.storeKey,
      value: storeItem.storeValue,
    };
  });
