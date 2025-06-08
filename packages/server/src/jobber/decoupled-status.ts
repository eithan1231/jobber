import { getUnixTimestamp } from "~/util.js";
import { LoopBase } from "~/loop-base.js";

type DecoupledStatusItem = {
  level: "info" | "warn" | "error";
  message: string;
  created: number;
  updated: number;
  ttl: number;
};

export class DecoupledStatus extends LoopBase {
  protected loopDuration = 1000;
  protected loopShutdown = undefined;
  protected loopStartup = undefined;

  private records = new Map<string, DecoupledStatusItem>();

  protected async loopIteration() {
    const now = getUnixTimestamp();

    for (const [key, item] of this.records.entries()) {
      if (now - item.created > item.ttl) {
        this.records.delete(key);
      }
    }
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
}
