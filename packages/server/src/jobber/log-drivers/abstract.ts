import { LoopBase } from "~/loop-base.js";

export type LogDriverBaseItem = {
  actionId: string;
  created: Date;
  jobId: string;
  jobName: string;
  message: string;
  source: "system" | "runner";
};

export type LogDriverBaseQuery = {
  jobId: string;
  actionId?: string;
};

export type LogDriverBaseQueryItem = {
  created: Date;
  message: string;
};

export abstract class LogDriverBase extends LoopBase {
  protected loopDuration = 2500;
  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private logs = new Array<LogDriverBaseItem>();

  protected abstract flushChunk(logs: LogDriverBaseItem[]): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  public abstract query(
    query: LogDriverBaseQuery
  ): Promise<LogDriverBaseQueryItem[]>;

  public abstract isQueryEnabled(): boolean;

  protected async loopIteration() {
    await this.flushLogs();

    await this.cleanup();
  }

  public write(log: LogDriverBaseItem) {
    this.logs.push(log);
  }

  private async flushLogs() {
    const logs = this.logs.splice(0).filter((item) => !!item.message);

    if (logs.length <= 0) {
      return;
    }

    this.flushChunk(logs);
  }
}
