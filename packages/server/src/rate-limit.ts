import { LoopBase } from "@jobber/common";
import { singleton } from "tsyringe";

type BucketItem = {
  count: number;

  created: number;
  expires: number;
};

// Minutely
const RATE_LIMIT_PERIOD_MS = 60 * 1000;

@singleton()
export class RateLimit extends LoopBase {
  protected loopDuration = 60 * 1000; // 1 minute

  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private buckets = new Map<string, BucketItem>();

  private createBucketKey(key: string) {
    const calculatedPeriod = Date.now() - (Date.now() % RATE_LIMIT_PERIOD_MS);

    return `${key}:${calculatedPeriod}`;
  }

  public isRateLimited(key: string, limit: number) {
    return false;

    // TODO: Reenable
    // if (this.status !== "started") {
    //   throw new Error("RateLimit is not started");
    // }

    // const bucketKey = this.createBucketKey(key);
    // const bucket = this.buckets.get(bucketKey);

    // return bucket && bucket.count >= limit;
  }

  public increment(key: string) {
    if (this.status !== "started") {
      throw new Error("RateLimit is not started");
    }

    const bucketKey = this.createBucketKey(key);
    const bucket = this.buckets.get(bucketKey);

    if (!bucket) {
      this.buckets.set(bucketKey, {
        count: 1,
        created: Date.now(),
        expires: Date.now() + RATE_LIMIT_PERIOD_MS,
      });
      return;
    }

    bucket.count += 1;
  }

  protected async loopIteration() {
    const now = Date.now();

    for (const [key, bucket] of this.buckets) {
      if (bucket.expires <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
