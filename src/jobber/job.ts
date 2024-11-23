import { mkdir, readdir, readFile, rm, unlink, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { JobController } from "./job-controller.js";

import { CronTime } from "cron";
import { randomUUID } from "crypto";
import { REGEX_ALPHA_NUMERIC_DASHES } from "~/constants.js";
import { sanitiseFilename } from "~/util.js";

const DIRECTORY_JOBS = path.join(process.cwd(), "./config/jobs");

export const registerJobSchema = z.object({
  version: z.string(),

  name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
  description: z.string().optional(),

  execution: z.object({
    conditions: z.array(
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("schedule"),
        timezone: z.string().optional(),
        cron: z.string(),
      })
    ),

    action: z.union([
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("zip"),
        keepAlive: z.boolean().default(false),
        refreshTimeout: z.number().default(60 * 60),
        entrypoint: z.string().default("index.js"),
      }),
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("script"),
        keepAlive: z.boolean().default(false),
        refreshTimeout: z.number().default(60 * 60),
        script: z.string(),
      }),
    ]),
  }),
});

export type RegisterJobSchemaType = z.infer<typeof registerJobSchema>;

type JobItem = {
  status: "active" | "closing";
  base: RegisterJobSchemaType;
  directory: string;
  directoryRuntime: string;
};

type JobSchedule = {
  jobName: string;
  jobExecutionConditionId: string;

  cronTime: CronTime;
  runAt: number;

  timezone?: string;
  cron: string;
};

export class Job {
  private jobController: JobController;

  private jobs: Map<string, JobItem> = new Map();

  private jobSchedules: Map<string, JobSchedule> = new Map();

  private eventScheduleTickInterval: NodeJS.Timeout | null = null;

  constructor(jobController: JobController) {
    this.jobController = jobController;
  }

  public async start() {
    const jobs = await readdir(DIRECTORY_JOBS);

    for (const job of jobs) {
      const directoryJob = path.join(DIRECTORY_JOBS, job);
      const directoryJobConfig = path.join(directoryJob, "config.json");

      const content = await readFile(directoryJobConfig);

      const contentParsed = JSON.parse(content.toString());

      await this.registerJob(directoryJob, contentParsed);
    }

    this.eventScheduleTickInterval = setInterval(() => {
      this.eventScheduleTick();
    }, 1000);
  }

  public async stop() {
    if (this.eventScheduleTickInterval) {
      clearInterval(this.eventScheduleTickInterval);
    }

    for (const [jobId, _job] of this.jobs.entries()) {
      await this.deregisterJob(jobId);
    }
  }

  public async getJobs() {
    const result: RegisterJobSchemaType[] = [];

    for (const job of this.jobs.values()) {
      result.push(job.base);
    }

    return result;
  }

  public async upsertJobScript(payload: unknown) {
    const job = await registerJobSchema.parseAsync(payload);

    const existingJob = this.jobs.get(job.name);

    const directoryJob = path.join(DIRECTORY_JOBS, sanitiseFilename(job.name));
    const directoryJobConfig = path.join(directoryJob, "config.json");

    if (existingJob) {
      await this.deregisterJob(job.name);
    }

    await mkdir(directoryJob, { recursive: true });

    await writeFile(directoryJobConfig, JSON.stringify(job));

    await this.registerJob(directoryJob, job);
  }

  private eventScheduleTick() {
    const timestamp = Date.now();

    for (const [key, jobSchedule] of this.jobSchedules.entries()) {
      if (jobSchedule.runAt > timestamp) {
        continue;
      }

      console.log(
        `[Job/eventScheduleTick] Running schedule ${jobSchedule.jobName}, runAt ${jobSchedule.runAt}, jobExecutionConditionId ${jobSchedule.jobExecutionConditionId}`
      );

      this.jobSchedules.set(key, {
        ...jobSchedule,
        runAt: jobSchedule.cronTime.sendAt().toMillis(),
      });

      const job = this.jobs.get(jobSchedule.jobName);

      if (!job) {
        console.log(
          `[Job/eventScheduleTick] Failed to find job, jobName ${jobSchedule.jobName}`
        );

        continue;
      }

      this.handleAction(job);
    }
  }

  private async handleAction(job: JobItem) {
    const response = await this.jobController.sendHandleRequest(
      job.base.execution.action.id,
      {
        message: "hello world!",
      }
    );

    if (!response.success) {
      console.log(
        `[Job/handleAction] Job failed in ${response.duration}ms with error ${response.error}`
      );

      return;
    }

    console.log(`[Job/handleAction] Job finished in ${response.duration}ms`);
  }

  private async registerJob(directory: string, payload: RegisterJobSchemaType) {
    if (this.jobs.has(payload.name)) {
      const job = this.jobs.get(payload.name);

      if (job?.status === "active") {
        throw new Error("Cannot register an already active job");
      }

      if (job?.status === "closing") {
        throw new Error("Cannot reregister job while its closing");
      }

      throw new Error("Cannot register job");
    }

    const parsed = await registerJobSchema.parseAsync(payload);

    const jobItem: JobItem = {
      status: "active",
      base: parsed,
      directory,
      directoryRuntime: path.join(directory, "runtime"),
    };

    await mkdir(jobItem.directoryRuntime, { recursive: true });

    for (const condition of parsed.execution.conditions) {
      if (condition.type === "schedule") {
        const cronTime = new CronTime(condition.cron, condition.timezone);

        this.jobSchedules.set(condition.id, {
          jobName: parsed.name,
          jobExecutionConditionId: condition.id,

          cronTime: cronTime,
          runAt: cronTime.sendAt().toMillis(),

          cron: condition.cron,
          timezone: condition.timezone,
        });
      }
    }

    if (parsed.execution.action.type === "script") {
      const entrypointSecret = `entrypoint-top-secret-cant-find-me.js`;

      const entrypointClient = "./index.js";

      await writeFile(
        path.join(jobItem.directoryRuntime, entrypointClient),
        parsed.execution.action.script
      );

      const entrypointSecretContent = (
        await readFile("./src/jobber/child-wrapper/entrypoint.js", "utf8")
      ).replaceAll("<<entrypointClient>>", entrypointClient);

      await writeFile(
        path.join(jobItem.directoryRuntime, entrypointSecret),
        entrypointSecretContent
      );

      this.jobController.registerAction({
        id: parsed.execution.action.id,
        jobName: parsed.name,

        keepAlive: parsed.execution.action.keepAlive,
        refreshTimeout: parsed.execution.action.refreshTimeout,

        runtime: {
          directory: jobItem.directoryRuntime,
          entrypoint: entrypointSecret,
        },
      });
    }

    this.jobs.set(jobItem.base.name, jobItem);
  }

  private async deregisterJob(jobName: string) {
    const job = this.jobs.get(jobName);

    if (!job) {
      throw new Error("Failed to get job");
    }

    for (const [jobScheduleId, jobSchedule] of this.jobSchedules.entries()) {
      if (jobSchedule.jobName === jobName) {
        this.jobSchedules.delete(jobScheduleId);
      }
    }

    if (job.base.execution.action.type === "script") {
      await this.jobController.deregisterAction(job.base.execution.action.id);

      await rm(job.directoryRuntime, {
        recursive: true,
      });
    }

    this.jobs.delete(jobName);
  }
}
