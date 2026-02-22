import {
  EventMqttRequest,
  EventMqttResponse,
  EventMqttResponse_Status,
} from "@jobber/grpc/runner.js";
import { Runner } from "~/runner.js";

export class MqttContext {
  constructor(
    private runner: Runner,
    private request: EventMqttRequest,
  ) {}

  public get name() {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    return this.request.context.triggerName;
  }

  public get topic() {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    return this.request.topic;
  }

  public get payload() {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    return this.request.payload;
  }

  public get json() {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    try {
      return JSON.parse(this.request.payload.toString());
    } catch (err) {
      throw new Error("Failed to parse MQTT payload as JSON");
    }
  }

  public async publish(topic: string, payload: string) {
    if (!this.request.context) {
      throw new Error("MqttContext is missing context");
    }

    await this.runner.client.methods.publishMqttMessage({
      jobId: this.runner.jobId,
      topic,
      payload,
    });
  }

  public createResponse(): EventMqttResponse {
    return {
      status: EventMqttResponse_Status.ACCEPTED,
    };
  }
}
