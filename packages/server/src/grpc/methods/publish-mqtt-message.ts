import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { container } from "tsyringe";
import { jobModel } from "~/db/job.js";
import { TriggerMqtt } from "~/jobber/triggers/mqtt.js";
import { authorizedCall } from "../util.js";

export const publishMqttMessage: ServiceImplementation<GeneralAPIDefinition>["publishMqttMessage"] =
  authorizedCall(async (request, _context, bouncer) => {
    const job = await jobModel.byId(request.jobId);

    if (!job) {
      throw new ServerError(Status.NOT_FOUND, "Job not found");
    }

    if (!bouncer.canPublishMqttMessage(job)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const triggerMqtt = container.resolve(TriggerMqtt);

    await triggerMqtt.publishMqttMessage(
      job.id,
      request.topic,
      Buffer.from(request.payload),
    );

    return {};
  });
