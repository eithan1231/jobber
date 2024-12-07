import { appendFile, mkdir, readdir } from "fs/promises";
import {
  getPathJobLogsChunkDirectory,
  getPathJobLogsChunkFile,
} from "~/paths.js";
import { awaitTruthy, readFileLines, timeout } from "~/util.js";
import { Job } from "./job.js";
import { StatusLifecycle } from "./types.js";
import path from "path";

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

    for (const job of this.job.getJobs()) {
      await mkdir(getPathJobLogsChunkDirectory(job.name), { recursive: true });
    }

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

  public async findLogs(
    jobName: string,
    filter: Partial<LogsLine> & { elapsed?: number }
  ) {
    const result: LogsLine[] = [];

    const timeNow = Date.now();

    // 2 hours default
    const elapsed = filter.elapsed ?? 60 * 60 * 12;

    // Limit results if elapsed has not been passed through
    const limitResults = !filter.elapsed;
    const limitResultsCount = 256;

    const chunkDir = getPathJobLogsChunkDirectory(jobName);

    const chunkFiles = await readdir(chunkDir);

    const chunkFilesFiltered = chunkFiles
      .filter((file) => {
        const fileTime = Number(path.parse(file).name);

        if (isNaN(fileTime)) {
          return false;
        }

        if (timeNow - fileTime > 1000 * elapsed) {
          return false;
        }

        return true;
      })
      .sort()
      .reverse();

    let currentResultsCount = 0;

    for (const file of chunkFilesFiltered) {
      const filepath = path.join(chunkDir, file);

      await readFileLines(filepath, (line) => {
        const lineParsed = JSON.parse(line) as LogsLine;

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

        if (
          filter.message &&
          !lineParsed.message
            .toLowerCase()
            .includes(filter.message.toLowerCase())
        ) {
          return;
        }

        result.push(lineParsed);

        currentResultsCount++;
      });

      if (limitResults && currentResultsCount > limitResultsCount) {
        break;
      }
    }

    if (limitResults && result.length - limitResultsCount > 0) {
      // Remove the first results. Order will be ascending, so we will preserve the latest appended logs.
      result.splice(0, result.length - limitResultsCount);
    }

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
      const date = new Date();

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

        const filename = getPathJobLogsChunkFile(jobName, date);

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
