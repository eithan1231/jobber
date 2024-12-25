import assert from "assert";
import { awaitTruthy, timeout } from "~/util.js";
import { StatusLifecycle } from "../types.js";

export type LogDriverBaseItem = {
  actionId: string;
  created: number;
  jobId: string;
  message: string;
  source: "system" | "runner";
};

export type LogDriverBaseQuery = {
  jobId: string;
  actionId?: string;
};

export type LogDriverBaseQueryItem = {
  created: number;
  message: string;
};

export abstract class LogDriverBase {
  private logs = new Array<LogDriverBaseItem>();

  private isLoopRunning = false;

  private status: StatusLifecycle = "neutral";

  protected abstract flushChunk(logs: LogDriverBaseItem[]): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  public abstract query(
    query: LogDriverBaseQuery
  ): Promise<LogDriverBaseQueryItem[]>;

  public abstract isQueryEnabled(): boolean;

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

  public write(log: LogDriverBaseItem) {
    this.logs.push(log);
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      await this.flushLogs();

      await timeout(2500);
    }

    await this.flushLogs();

    this.isLoopRunning = false;
  }

  private async flushLogs() {
    const logs = this.logs.splice(0).filter((item) => !!item.message);

    if (logs.length <= 0) {
      return;
    }

    this.flushChunk(logs);
  }
}
