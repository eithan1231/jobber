import { randomUUID } from "crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { REGEX_ALPHA_NUMERIC_DASHES } from "~/constants.js";
import {
  fileExists,
  getTmpFile,
  getUnixTimestamp,
  sanitiseFilename,
  unzip,
} from "~/util.js";
import {
  JobController,
  SendHandleRequestHttp,
  SendHandleResponse,
} from "./job-controller.js";
import { JobHttp } from "./job-http.js";
import { JobScheduler } from "./job-schedules.js";

const DIRECTORY_JOBS = path.join(process.cwd(), "./config/jobs");

const registerJobSchemaActionBase = z.object({
  id: z.string().default(() => randomUUID()),
  keepAlive: z.boolean().default(false),
  refreshTimeout: z.number().default(60 * 60),

  environment: z.record(z.string().toUpperCase(), z.string()).default({}),
});

export const registerJobSchema = z.object({
  version: z.string(),

  name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
  description: z.string().optional(),

  action: z.union([
    registerJobSchemaActionBase.extend({
      type: z.literal("zip"),
      entrypoint: z.string().default("index.js"),
      archiveFileName: z.string(),
    }),
    registerJobSchemaActionBase.extend({
      type: z.literal("script"),
      script: z.string(),
    }),
  ]),

  conditions: z.array(
    z.union([
      z.object({
        type: z.literal("schedule"),
        timezone: z.string().optional(),
        cron: z.string(),
      }),
      z.object({
        type: z.literal("http"),
        method: z.string(),
        path: z.string(),
      }),
    ])
  ),
});

export type RegisterJobSchemaType = z.infer<typeof registerJobSchema>;

type HttpGetJobsItem = {
  version: string;
  name: string;
  description?: string;

  action:
    | {
        type: "script";
        keepAlive: boolean;
        refreshTimeout: number;
        script: string;
      }
    | {
        type: "zip";
        keepAlive: boolean;
        refreshTimeout: number;
        entrypoint: string;
      };

  conditions: Array<
    | {
        type: "http";
        method: string;
        path: string;
      }
    | {
        type: "schedule";
        timezone?: string;
        cron: string;
      }
  >;
};

const packageJsonSchema = z.object({
  name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
  version: z.string(),
  description: z.string().optional(),
  type: z.enum(["module", "commonjs"]).default("commonjs"),
  main: z.string(),

  jobber: z.object({
    action: z
      .object({
        environment: z.record(z.string().toUpperCase(), z.string()).optional(),
        keepAlive: z.boolean().optional(),
        refreshTimeout: z.number().optional(),
      })
      .optional(),

    conditions: z
      .array(
        z.union([
          z.object({
            type: z.literal("schedule"),
            timezone: z.string().optional(),
            cron: z.string(),
          }),
          z.object({
            type: z.literal("http"),
            method: z.string(),
            path: z.string(),
          }),
        ])
      )
      .min(1),
  }),
});

export type PackageJsonSchemaType = z.infer<typeof packageJsonSchema>;

type JobItem = RegisterJobSchemaType & {
  status: "active" | "closing";
  directory: string;
  directoryRuntime: string;
};

export class Job {
  private jobController: JobController;

  private jobScheduler: JobScheduler;

  private jobHttp: JobHttp;

  private jobs: Map<string, JobItem> = new Map();

  constructor(jobController: JobController) {
    this.jobController = jobController;

    this.jobScheduler = new JobScheduler();

    this.jobHttp = new JobHttp();

    this.jobHttp.registerHandleEvent((jobName, payload) =>
      this.onHttpEvent(jobName, payload)
    );

    this.jobScheduler.registerHandleEvent((name) => this.onScheduleEvent(name));
  }

  public async start() {
    await mkdir(DIRECTORY_JOBS, { recursive: true });

    const jobs = await readdir(DIRECTORY_JOBS);

    for (const job of jobs) {
      const directoryJob = path.join(DIRECTORY_JOBS, job);
      const directoryJobConfig = path.join(directoryJob, "config.json");

      const content = await readFile(directoryJobConfig);

      const contentParsed = JSON.parse(content.toString());

      await this.registerJob(directoryJob, contentParsed);
    }

    this.jobScheduler.start();
  }

  public async stop() {
    this.jobScheduler.stop();

    for (const [jobId, _job] of this.jobs.entries()) {
      await this.deregisterJob(jobId);
    }
  }

  public async httpGetJobs() {
    const result: HttpGetJobsItem[] = [];

    for (const job of this.jobs.values()) {
      const action: HttpGetJobsItem["action"] =
        job.action.type === "script"
          ? {
              type: "script",
              keepAlive: job.action.keepAlive,
              refreshTimeout: job.action.refreshTimeout,
              script: job.action.script,
            }
          : {
              type: "zip",
              keepAlive: job.action.keepAlive,
              refreshTimeout: job.action.refreshTimeout,
              entrypoint: job.action.entrypoint,
            };

      const conditions: HttpGetJobsItem["conditions"] = job.conditions.map(
        (condition) => {
          if (condition.type === "http") {
            return {
              type: "http",
              method: condition.method,
              path: condition.path,
            };
          }

          if (condition.type === "schedule") {
            return {
              type: "schedule",
              timezone: condition.timezone,
              cron: condition.cron,
            };
          }

          throw new Error("Unexpected condition type");
        }
      );

      const item: HttpGetJobsItem = {
        name: job.name,
        description: job.description,

        version: job.version,
        action,
        conditions,
      };

      result.push(item);
    }

    return result;
  }

  public async httpDeleteJob(jobName: string) {
    console.log(`[httpDeleteJob] Started`);

    const existingJob = this.jobs.get(jobName);

    if (!existingJob) {
      return {
        success: false,
        message: "Job not found",
      } as const;
    }

    const directoryJob = path.join(DIRECTORY_JOBS, sanitiseFilename(jobName));

    console.log(`[httpDeleteJob] Deregistering job...`);

    await this.deregisterJob(jobName);

    console.log(`[httpDeleteJob] Deregistered`);

    console.log(`[httpDeleteJob] Deleting local files...`);

    await rm(directoryJob, { recursive: true });

    console.log(`[httpDeleteJob] deleted local files`);

    return {
      success: true,
      message: "Ok",
    } as const;
  }

  public async httpUpsertJobScript(payload: unknown) {
    console.log(`[upsertJobScript] Started`);

    const job = await registerJobSchema.parseAsync(payload);

    const existingJob = this.jobs.get(job.name);

    console.log(
      `[upsertJobScript] Metadata, name ${job.name}, version ${
        job.version
      }, existing ${existingJob ? "true" : "false"}`
    );

    const directoryJob = path.join(DIRECTORY_JOBS, sanitiseFilename(job.name));
    const directoryJobConfig = path.join(directoryJob, "config.json");

    if (existingJob) {
      console.log(`[upsertJobScript] Existing job. Deregistering...`);

      await this.deregisterJob(job.name);

      console.log(`[upsertJobScript] Deregistered.`);
    }

    await mkdir(directoryJob, { recursive: true });

    await writeFile(directoryJobConfig, JSON.stringify(job, null, 2));

    console.log(`[upsertJobScript] Registering...`);

    await this.registerJob(directoryJob, job);

    console.log(`[upsertJobScript] Registered.`);
  }

  public async httpUpsertJobZip(archiveFile: string) {
    console.log(`[Job/upsertJobZip] Started`);

    const filenames: string[] = [];

    try {
      const directoryZipContent = getTmpFile({
        length: 6,
      });

      await mkdir(directoryZipContent, {
        recursive: true,
      });

      filenames.push(directoryZipContent);

      console.log(
        `[Job/upsertJobZip] Unzipping ${archiveFile} to ${directoryZipContent}`
      );

      await unzip(archiveFile, directoryZipContent);

      console.log(`[Job/upsertJobZip] Unzipped.`);
      console.log(`[Job/upsertJobZip] Validating package.json file...`);

      const directoryZipContentPackageFile = path.join(
        directoryZipContent,
        "package.json"
      );

      if (!(await fileExists(directoryZipContentPackageFile))) {
        console.log(`[Job/upsertJobZip] package.json not present.`);

        return {
          success: false,
          message: "Expected package.json to be present",
        } as const;
      }

      const packageContent = await readFile(
        directoryZipContentPackageFile,
        "utf8"
      );

      const packageContentPared = await packageJsonSchema.safeParseAsync(
        JSON.parse(packageContent)
      );

      if (!packageContentPared.success) {
        const formattedErrors = packageContentPared.error.errors
          .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
          .join(", ");

        console.log(
          `[Job/upsertJobZip] Validation of package.json failed, ${formattedErrors}`
        );

        return {
          success: false,
          message: `package.json validation failure... ${formattedErrors}`,
        } as const;
      }

      console.log(`[Job/upsertJobZip] Validated package.json.`);

      const archiveFilenameInternal = `archive-${getUnixTimestamp()}.zip`;

      const directoryJob = path.join(
        DIRECTORY_JOBS,
        sanitiseFilename(packageContentPared.data.name)
      );

      const directoryJobConfig = path.join(directoryJob, "config.json");
      const directoryJobArchive = path.join(
        directoryJob,
        archiveFilenameInternal
      );

      const existingJob = this.jobs.get(packageContentPared.data.name);

      // A bit of cleanup of the original job.
      if (existingJob) {
        console.log(
          `[Job/upsertJobZip] Deregistering existing job ${existingJob.name}.`
        );

        await this.deregisterJob(packageContentPared.data.name);

        console.log(`[Job/upsertJobZip] Deregistered.`);
      }

      console.log(`[Job/upsertJobZip] Copying new files and zip archive.`);

      await mkdir(directoryJob, { recursive: true });

      await cp(archiveFile, directoryJobArchive);

      // Create config file
      const job = await registerJobSchema.parseAsync({
        name: packageContentPared.data.name,
        version: packageContentPared.data.version,
        description: packageContentPared.data.description,

        action: {
          type: "zip",
          archiveFileName: archiveFilenameInternal,
          entrypoint: packageContentPared.data.main,
          keepAlive: packageContentPared.data.jobber?.action?.keepAlive,
          refreshTimeout:
            packageContentPared.data.jobber.action?.refreshTimeout,
          environment: packageContentPared.data.jobber.action?.environment,
        },

        conditions: packageContentPared.data.jobber.conditions.map(
          (condition) => ({
            type: condition.type,
            timezone: condition.timezone,
            cron: condition.cron,
          })
        ),
      });

      await writeFile(directoryJobConfig, JSON.stringify(job, null, 2));

      console.log(`[Job/upsertJobZip] Registering new job...`);

      await this.registerJob(directoryJob, job);

      console.log(`[Job/upsertJobZip] Registered`);

      if (existingJob && existingJob.action.type === "zip") {
        console.log(`[Job/upsertJobZip] Removing legacy zip fle.`);

        await rm(path.join(directoryJob, existingJob.action.archiveFileName));
      }

      console.log(`[Job/upsertJobZip] Finished`);

      return {
        success: true,
        message: "ok",
      } as const;
    } finally {
      for (const filename of filenames) {
        await rm(filename, {
          recursive: true,
        });
      }
    }
  }

  public async httpRouteHandler(payload: SendHandleRequestHttp) {
    return this.jobHttp.run(payload);
  }

  private async onHttpEvent(
    jobName: string,
    payload: SendHandleRequestHttp
  ): Promise<SendHandleResponse> {
    const job = this.jobs.get(jobName);

    if (!job) {
      throw new Error(`Failed to find job, job name ${jobName}`);
    }

    const response = await this.jobController.sendHandleRequest(
      job.action.id,
      payload
    );

    console.log(
      `[Job/onHttpEvent] Job finished in ${response.duration}ms ${
        response.success ? "successfully" : "with errors"
      }`
    );

    return response;
  }

  private async onScheduleEvent(jobName: string): Promise<SendHandleResponse> {
    const job = this.jobs.get(jobName);

    if (!job) {
      throw new Error(`Failed to find job, job name ${jobName}`);
    }

    const response = await this.jobController.sendHandleRequest(job.action.id, {
      type: "schedule",
    });

    console.log(
      `[Job/onScheduleEvent] Job finished in ${response.duration}ms ${
        response.success ? "successfully" : "with errors"
      }`
    );

    return response;
  }

  private async registerJob(directory: string, payload: RegisterJobSchemaType) {
    const parsed = await registerJobSchema.parseAsync(payload);

    console.log(`[Job/registerJob] Registering ${parsed.name}...`);

    if (this.jobs.has(parsed.name)) {
      const job = this.jobs.get(parsed.name);

      if (job?.status === "active") {
        throw new Error("Cannot register an already active job");
      }

      if (job?.status === "closing") {
        throw new Error("Cannot reregister job while its closing");
      }

      throw new Error("Cannot register job");
    }

    console.log(
      `[Job/registerJob] Creating baseline configuration files and folders..`
    );

    const jobItem: JobItem = {
      ...parsed,
      status: "active",
      directory,
      directoryRuntime: path.join(directory, "runtime"),
    };

    const entrypointSecret = `entrypoint-top-secret-cant-find-me.js`;

    const clientConfig = {
      entrypointClient: "./index.js",
    };

    if (jobItem.action.type === "zip") {
      if (jobItem.action.entrypoint.startsWith("./")) {
        clientConfig.entrypointClient = jobItem.action.entrypoint;
      } else {
        clientConfig.entrypointClient = `./${jobItem.action.entrypoint}`;
      }
    }

    const entrypointSecretContent = (
      await readFile("./src/jobber/child-wrapper/entrypoint.js", "utf8")
    ).replaceAll(
      "/*<<CLIENT_CONFIG>>*/",
      JSON.stringify(clientConfig, null, 2)
    );

    await mkdir(jobItem.directoryRuntime, { recursive: true });

    await writeFile(
      path.join(jobItem.directoryRuntime, entrypointSecret),
      entrypointSecretContent
    );

    console.log(`[Job/registerJob] Created baseline files and folders!`);

    if (jobItem.action.type === "script") {
      await writeFile(
        path.join(jobItem.directoryRuntime, clientConfig.entrypointClient),
        jobItem.action.script
      );
    }

    if (jobItem.action.type === "zip") {
      await unzip(
        path.join(jobItem.directory, jobItem.action.archiveFileName),
        jobItem.directoryRuntime
      );
    }

    await this.jobController.registerAction({
      id: jobItem.action.id,
      jobName: jobItem.name,

      environment: jobItem.action.environment,

      keepAlive: jobItem.action.keepAlive,
      refreshTimeout: jobItem.action.refreshTimeout,

      runtime: {
        directory: jobItem.directoryRuntime,
        entrypoint: entrypointSecret,
      },
    });

    console.log(`[Job/registerJob] Registered action ${parsed.name}`);

    console.log(`[Job/registerJob] Creating job...`);

    this.jobs.set(jobItem.name, jobItem);

    console.log(`[Job/registerJob] Creating job!`);

    console.log(`[Job/registerJob] Creating and registering conditions...`);

    for (const condition of parsed.conditions) {
      if (condition.type === "schedule") {
        console.log(
          `[Job/registerJob] Condition for ${parsed.name}, cron "${condition.cron}", tz ${condition.timezone}`
        );

        this.jobScheduler.createSchedule({
          jobName: parsed.name,

          cron: condition.cron,
          timezone: condition.timezone,
        });
      }

      if (condition.type === "http") {
        console.log(
          `[Job/registerJob] Condition for ${parsed.name}, method "${condition.method}", path ${condition.path}`
        );

        this.jobHttp.createRoute({
          jobName: parsed.name,
          method: condition.method,
          path: condition.path,
        });
      }
    }

    console.log(`[Job/registerJob] Conditions Finished!`);

    console.log(`[Job/registerJob] Finished ${parsed.name}!`);
  }

  private async deregisterJob(jobName: string) {
    const job = this.jobs.get(jobName);

    if (!job) {
      throw new Error("Failed to get job");
    }

    this.jobScheduler.deleteSchedulesByJobName(jobName);
    this.jobHttp.deleteRoutesByJobName(jobName);

    if (job.action.type === "script" || job.action.type === "zip") {
      await this.jobController.deregisterAction(job.action.id);

      await rm(job.directoryRuntime, {
        recursive: true,
      });
    }

    this.jobs.delete(jobName);
  }
}
