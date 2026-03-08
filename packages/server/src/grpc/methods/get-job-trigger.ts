import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { triggersModel } from "~/db/triggers.js";
import { mapGrpcTrigger } from "../grpc-maps.js";
import { authorizedCall } from "../util.js";

export const getJobTrigger: ServiceImplementation<GeneralAPIDefinition>["getJobTrigger"] =
  authorizedCall(async (request, _context, bouncer) => {
    const trigger = await triggersModel.byId(request.triggerId);

    if (!trigger) {
      throw new ServerError(Status.NOT_FOUND, "Trigger not found");
    }

    if (trigger.jobId !== request.jobId) {
      throw new ServerError(Status.NOT_FOUND, "Trigger not found");
    }

    if (!bouncer.canReadJobTriggers(trigger)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    return {
      trigger: mapGrpcTrigger(trigger),
    };
  });
