import assert from "node:assert";
import { StatusLifecycle } from "./types.js";
import { awaitTruthy, getUnixTimestamp, timeout } from "~/util.js";

type DecoupledStatusItem = {
  level: "info" | "warn" | "error";
  message: string;
  created: number;
  updated: number;
  ttl: number;
};

export class DecoupledStatus {
  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

  private records = new Map<string, DecoupledStatusItem>();

  public async start() {
    assert(this.status === "neutral");

    this.status = "starting";

    this.loop();

    await awaitTruthy(() => Promise.resolve(this.isLoopRunning));

    this.status = "started";
  }

  public async stop() {
    assert(this.status === "started");

    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";
  }

  public async setItem(
    key: string,
    item: {
      level?: DecoupledStatusItem["level"];
      message: DecoupledStatusItem["message"];
      ttl?: DecoupledStatusItem["ttl"];
    }
  ) {
    this.records.set(key, {
      level: item.level ?? "info",
      ttl: item.ttl ?? 60 * 3,
      message: item.message,
      created: getUnixTimestamp(),
      updated: getUnixTimestamp(),
    });
  }

  public async getItem(key: string) {
    const result = this.records.get(key);

    if (!result) {
      return null;
    }

    if (getUnixTimestamp() - result.created > result.ttl) {
      this.records.delete(key);
      return null;
    }

    return structuredClone(result);
  }

  public async deleteItem(key: string) {
    this.records.delete(key);
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      await this.loopCleanup();

      await timeout(1000);
    }

    this.isLoopRunning = false;
  }

  private async loopCleanup() {
    const now = getUnixTimestamp();

    for (const [key, item] of this.records.entries()) {
      if (now - item.created > item.ttl) {
        this.records.delete(key);
      }
    }
  }
}
