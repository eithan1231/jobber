import assert from "assert";
import { and, eq, lt } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { storeTable } from "~/db/schema/store.js";
import { awaitTruthy, getUnixTimestamp, timeout } from "~/util.js";
import { StatusLifecycle } from "./types.js";
import { jobsTable } from "~/db/schema/jobs.js";

type StoreItem = {
  key: string;
  value: string;
  expiry: number | null;
  created: number;
  modified: number;
};

export class Store {
  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

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

  public async getItem(jobId: string, key: string): Promise<StoreItem | null> {
    const result = (
      await getDrizzle()
        .select()
        .from(storeTable)
        .where(and(eq(storeTable.jobId, jobId), eq(storeTable.storeKey, key)))
        .limit(1)
    ).at(0);

    if (!result) {
      return null;
    }

    return {
      key: result.storeKey,
      value: result.storeValue,
      created: result.created,
      modified: result.modified,
      expiry: result.expiry,
    };
  }

  public async setItem(
    jobId: string,
    key: string,
    options: {
      value: string;
      ttl?: number;
    }
  ): Promise<StoreItem | null> {
    const expiry = options.ttl ? getUnixTimestamp() + options.ttl : null;

    const result = (
      await getDrizzle()
        .insert(storeTable)
        .values({
          jobId: jobId,
          storeKey: key,
          created: getUnixTimestamp(),
          modified: getUnixTimestamp(),
          expiry: expiry,
          storeValue: options.value,
        })
        .onConflictDoUpdate({
          set: {
            storeValue: options.value,
            expiry: expiry,
            modified: getUnixTimestamp(),
          },
          target: [storeTable.jobId, storeTable.storeKey],
        })
        .returning()
    ).at(0);

    if (!result) {
      return null;
    }

    return {
      key: result.storeKey,
      value: result.storeValue,
      created: result.created,
      modified: result.modified,
      expiry: result.expiry,
    };
  }

  public async deleteItem(
    jobId: string,
    key: string
  ): Promise<StoreItem | null> {
    const result = (
      await getDrizzle()
        .delete(storeTable)
        .where(and(eq(storeTable.jobId, jobId), eq(storeTable.storeKey, key)))
        .returning()
    ).at(0);

    if (!result) {
      return null;
    }

    return {
      key: result.storeKey,
      value: result.storeValue,
      created: result.created,
      modified: result.modified,
      expiry: result.expiry,
    };
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
    await getDrizzle()
      .delete(storeTable)
      .where(lt(storeTable.expiry, getUnixTimestamp()));
  }
}
