import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { JobController } from "./job-controller.js";

import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
} from "child_process";
import { CronTime } from "cron";
import { randomBytes, randomUUID } from "crypto";

export const registerJobSchema = z.object({
  version: z.string(),

  name: z.string(),
  description: z.string().optional(),

  execution: z.object({
    conditions: z.array(
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("schedule"),
        timezone: z.string().optional(),
        cron: z.string(),
        timeout: z.number().default(30),
      })
    ),

    action: z.union([
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("zip"),
        entrypoint: z.string().default("index.js"),
      }),
      z.object({
        id: z.string().default(() => randomUUID()),
        type: z.literal("script"),
        script: z.string(),
      }),
    ]),
  }),
});

export type RegisterJobSchemaType = z.infer<typeof registerJobSchema>;

type JobItem = {
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
  timeout: number;
};

type JobAction = {
  id: string;
  jobName: string;

  status: "ready";

  runtime: {
    directory: string;
    entrypoint: string;
  };
};

export class Job {
  private jobController: JobController;

  private jobs: JobItem[] = [];

  private jobSchedules: Map<string, JobSchedule> = new Map();

  private jobActions: Map<string, JobAction> = new Map();

  private eventScheduleTickInterval: NodeJS.Timeout | null = null;

  constructor(jobController: JobController) {
    this.jobController = jobController;
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

      const job = this.jobs.find(
        (index) => index.base.name === jobSchedule.jobName
      );

      if (!job) {
        console.log(
          `[Job/eventScheduleTick] Failed to find job, jobName ${jobSchedule.jobName}`
        );

        continue;
      }

      for (const [jobActionKey, jobAction] of this.jobActions.entries()) {
        if (jobAction.jobName != job.base.name) {
          continue;
        }

        this.handleAction(jobAction, job);
      }
    }
  }

  public async start() {
    const directoryJobs = "./config/jobs";

    const jobs = await readdir(directoryJobs);

    for (const job of jobs) {
      const directoryJob = path.join(process.cwd(), "./config/jobs", job);
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
  }

  private async handleAction(action: JobAction, job: JobItem) {
    // TODO: Migrate to preserve processes
    const jobRunnerIdentifier = `job-runner-id-${randomUUID()}`;

    this.jobController.registerExpectedClient(jobRunnerIdentifier);

    console.log(path.join(action.runtime.directory, action.runtime.entrypoint));

    const res = spawn(
      "node",
      [
        path.join(action.runtime.directory, action.runtime.entrypoint),
        "--job-runner-identifier",
        jobRunnerIdentifier,
        "--job-controller-host",
        "127.0.0.1",
        "--job-controller-port",
        "10211",
      ],
      {
        windowsHide: true,
        cwd: action.runtime.directory,
        stdio: "pipe",
      }
    );

    res.once("spawn", () => console.log("spawned"));
    res.once("close", () => console.log("closed"));

    res.stdout.on("data", (dat: Buffer) => console.log(dat.toString()));
    res.stderr.on("data", (dat: Buffer) => console.log(dat.toString()));

    const response = await this.jobController.sendHandle(
      jobRunnerIdentifier,
      {}
    );

    console.log(response);
  }

  private async registerJob(directory: string, payload: RegisterJobSchemaType) {
    const parsed = await registerJobSchema.parseAsync(payload);

    const jobItem: JobItem = {
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
          timeout: condition.timeout,
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
        await readFile("./src/child-wrapper/entrypoint.js", "utf8")
      ).replaceAll("<<entrypointClient>>", entrypointClient);

      await writeFile(
        path.join(jobItem.directoryRuntime, entrypointSecret),
        entrypointSecretContent
      );

      this.jobActions.set(parsed.execution.action.id, {
        id: parsed.execution.action.id,
        jobName: parsed.name,
        status: "ready",

        runtime: {
          directory: jobItem.directoryRuntime,
          entrypoint: entrypointSecret,
        },
      });
    }
    this.jobs.push(jobItem);
  }
}
