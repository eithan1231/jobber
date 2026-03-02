import {
  EventMqttResponse,
  EventMqttResponse_Status,
  EventScheduleRequest,
} from "@jobber/grpc/runner.js";
import { Runner } from "~/runner.js";

export class ScheduleContext {
  constructor(
    private runner: Runner,
    private request: EventScheduleRequest,
  ) {}

  public get name() {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    return this.request.context.triggerName;
  }

  public createResponse(): EventMqttResponse {
    return {
      status: EventMqttResponse_Status.ACCEPTED,
    };
  }
}
