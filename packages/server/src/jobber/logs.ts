import { awaitTruthy, readFileLines, timeout } from "~/util.js";
import { StatusLifecycle } from "./types.js";
import { Job } from "./job.js";
import { getPathJobLogsFile } from "~/paths.js";
import { appendFile, readFile } from "fs/promises";
import { createReadStream } from "fs";

export type LogsLine = {
  runnerId: string;
  actionId: string;
  jobName: string;
  jobVersion: string;
  source: "STDOUT" | "STDERR";
  timestamp: number;
  message: string;
};

export class Logs {
  private logs: Record<string, LogsLine[]> = {};

  private status: StatusLifecycle = "neutral";

  private isLoopRunning = false;

  private job: Job;

  constructor(job: Job) {
    this.job = job;
  }

  public async start() {
    if (["starting", "started", "stopping"].includes(this.status)) {
      throw new Error(
        `[Logs/start] Failed due to status of "${this.status}", expected status of "neutral"`
      );
    }

    this.status = "starting";

    this.loop();

    this.status = "started";
  }

  public async stop() {
    if (this.status !== "started") {
      throw new Error(
        `[Logs/start] Failed due to status of "${this.status}", expected status of "started"`
      );
    }

    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";
  }

  public async findLogs(jobName: string, filter: Partial<LogsLine>) {
    const result: LogsLine[] = [];

    const filename = getPathJobLogsFile(jobName);

    await readFileLines(filename, (line) => {
      const lineParsed = JSON.parse(line);

      if (filter.actionId && filter.actionId !== lineParsed.actionId) {
        return;
      }

      if (filter.jobName && filter.jobName !== lineParsed.jobName) {
        return;
      }

      if (filter.jobVersion && filter.jobVersion !== lineParsed.jobVersion) {
        return;
      }

      if (filter.runnerId && filter.runnerId !== lineParsed.runnerId) {
        return;
      }

      if (filter.source && filter.source !== lineParsed.source) {
        return;
      }

      if (filter.timestamp && filter.timestamp !== lineParsed.timestamp) {
        return;
      }

      if (filter.message && !lineParsed.message.includes(filter.message)) {
        return;
      }

      result.push(lineParsed);
    });

    return result;
  }

  public addLog(jobName: string, line: LogsLine) {
    if (this.logs[jobName]) {
      this.logs[jobName].push(line);
    } else {
      this.logs[jobName] = [line];
    }
  }

  private async loop() {
    console.log(`[Logs/loopWriter] Starting log writing loop`);

    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      const jobs = this.job.getJobs();
      const jobNames = Object.keys(this.logs);

      for (const jobName of jobNames) {
        if (!jobs.find((index) => index.name === jobName)) {
          delete this.logs[jobName];

          continue;
        }

        const logs = this.logs[jobName].splice(0, this.logs[jobName].length);

        if (logs.length <= 0) {
          continue;
        }

        const filename = getPathJobLogsFile(jobName);

        let appendContent = "";
        for (const log of logs) {
          appendContent += JSON.stringify(log) + "\n";
        }

        await appendFile(filename, appendContent, "utf8");
      }

      await timeout(250);
    }

    console.log(`[Logs/loopWriter] Log writing loop finished`);

    this.isLoopRunning = false;
  }
}
