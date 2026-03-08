import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { actionsModel } from "~/db/actions.js";
import { mapGrpcAction } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobAction: ServiceImplementation<GeneralAPIDefinition>["getJobAction"] =
  authorizedCall(async (request, _context, bouncer) => {
    const action = await actionsModel.byId(request.actionId);

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
