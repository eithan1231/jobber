import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServiceImplementation } from "nice-grpc";
import { actionsModel } from "~/db/actions.js";
import { mapGrpcAction } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobActions: ServiceImplementation<GeneralAPIDefinition>["getJobActions"] =
  authorizedCall(async (request, _context, bouncer) => {
    const actions = (await actionsModel.all())
      .filter((action) => {
        if (action.jobId !== request.jobId) {
          return false;
        }

        if (request.versionId && action.jobVersionId !== request.versionId) {
          return false;
        }

        return bouncer.canReadJobAction(action);
      })
      .map(mapGrpcAction);

    return {
      actions,
    };
  });
