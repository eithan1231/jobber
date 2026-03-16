import { ServerError, Status } from "nice-grpc";
import { Runner } from "~/runner.js";

export class GlobalContext {
  constructor(private runner: Runner) {}

  public async setStore(key: string, value: string, option?: { ttl?: number }) {
    if (typeof key !== "string" || typeof value !== "string") {
      throw new Error("Key and value must be strings");
    }

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
    if (typeof key !== "string") {
      throw new Error("Key must be a string");
    }

    await this.setStore(key, JSON.stringify(value), option);
  }

  public async getStore(key: string) {
    try {
      const item = await this.runner.client.methods.getStoreItem({
        jobId: this.runner.jobId,
        key: key,
      });

      return item.value;
    } catch (err) {
      if (err instanceof ServerError) {
        if (err.code === Status.NOT_FOUND) {
          return null;
        }
      }

      throw err;
    }
  }

  public async getStoreJson<T = unknown>(key: string): Promise<T | null> {
    const data = await this.getStore(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
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

  public async publish(topic: string, body: string) {
    return this.runner.client.methods.publishMqttMessage({
      jobId: this.runner.jobId,
      topic: topic,
      payload: body,
    });
  }
}
