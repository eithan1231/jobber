import { Runner } from "~/runner.js";

export class LegacyContext {
  constructor(private runner: Runner) {}

  public async setStore(key: string, value: string, option?: { ttl?: number }) {
    await this.runner.client.methods.setStoreItem({
      jobId: this.runner.jobId,
      key: key,
      value: value,
      ttl: option?.ttl,
    });
  }

  public async setStoreJson<T = unknown>(
    key: string,
    value: T,
    option?: { ttl?: number },
  ) {
    await this.setStore(key, JSON.stringify(value), option);
  }

  public async getStore(key: string) {
    return this.runner.client.methods.getStoreItem({
      jobId: this.runner.jobId,
      key: key,
    });
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
    return await this.runner.client.methods.deleteStoreItem({
      jobId: this.runner.jobId,
      key: key,
    });
  }

  public async deleteStoreJson(key: string) {
    await this.deleteStore(key);
  }

  public async publish(topic: string, body: Buffer | string | unknown) {
    let payload: string;

    if (typeof body === "object" && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
    } else if (typeof body === "string") {
      payload = body;
    } else if (Buffer.isBuffer(body)) {
      payload = body.toString("utf8");
    } else {
      throw new Error("Invalid body type for MQTT publish");
    }

    return this.runner.client.methods.publishMqttMessage({
      jobId: this.runner.jobId,
      topic: topic,
      payload: payload,
    });
  }
}
