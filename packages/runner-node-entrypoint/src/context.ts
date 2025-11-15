import { JobberHandlerRequest } from "./request.js";
import { JobberHandlerResponse } from "./response.js";
import { Runner } from "./runner.js";

export class JobberHandlerContext {
  private runner: Runner;
  private request: JobberHandlerRequest;
  private response: JobberHandlerResponse;

  constructor(
    runner: Runner,
    request: JobberHandlerRequest,
    response: JobberHandlerResponse
  ) {
    this.runner = runner;
    this.request = request;
    this.response = response;
  }

  public async setStore(key: string, value: string, option?: { ttl?: number }) {
    return this.runner.sendStoreSet(key, value, option);
  }

  public async setStoreJson<T = unknown>(
    key: string,
    value: T,
    option?: { ttl?: number }
  ) {
    await this.setStore(key, JSON.stringify(value), option);
  }

  public async getStore(key: string) {
    return this.runner.sendStoreGet(key);
  }

  public async getStoreJson<T = unknown>(key: string): Promise<T | null> {
    const data = await this.getStore(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data.value) as T;
    } catch (err) {
      console.error(err);

      return null;
    }
  }

  public async deleteStore(key: string) {
    return await this.runner.sendStoreDelete(key);
  }

  public async deleteStoreJson(key: string) {
    await this.runner.sendStoreDelete(key);
  }

  public async publish(topic: string, body: Buffer | string | unknown) {
    let payload: Buffer;

    if (typeof body === "object" && !Buffer.isBuffer(body)) {
      payload = Buffer.from(JSON.stringify(body));
    } else if (typeof body === "string") {
      payload = Buffer.from(body);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
    } else {
      throw new Error("Invalid body type for MQTT publish");
    }

    return this.runner.sendMqttPublish(topic, payload);
  }
}
