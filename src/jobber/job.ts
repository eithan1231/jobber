import assert from "assert";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { PATH_CONFIG_JOBS } from "~/constants.js";
import {
  getPathJobActionsDirectory,
  getPathJobConfigFile,
  getPathJobDirectory,
  getPathJobLogsDirectory,
  getPathJobTriggersDirectory,
} from "~/paths.js";
import { Actions } from "./actions.js";
import { Triggers } from "./triggers.js";
import { StatusLifecycle } from "./types.js";

const configSchema = z.object({
  name: z.string(),
  description: z.string(),

  version: z.string().nullable().default(null),
});

type ConfigSchemaType = z.infer<typeof configSchema>;

type JobItem = ConfigSchemaType & {
  directory: string;
};

export class Job {
  private status: StatusLifecycle = "neutral";

  private jobs = new Map<string, JobItem>();

  private actions = new Actions(this);

  private triggers = new Triggers(this);

  constructor() {
    this.triggers.registerHandleEvent((jobName, request) =>
      this.actions.sendHandleRequest(jobName, request)
    );
  }

  public getStatus() {
    return this.status;
  }

  public async start() {
    if (
      this.status === "starting" ||
      this.status === "started" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Actions/start] Cannot start with status of ${this.status}`
      );
    }

    this.status = "starting";

    await mkdir(PATH_CONFIG_JOBS, { recursive: true });

    const directories = await readdir(PATH_CONFIG_JOBS);

    for (const directory of directories) {
      if (directory === "." || directory === "..") {
        continue;
      }

      const config = await Job.readConfigFile(directory);

      await this.addJob({
        ...config,
        directory: path.join(PATH_CONFIG_JOBS, directory),
      });
    }

    await this.actions.start();

    await this.triggers.start();

    this.status = "started";
  }

  public async stop() {
    if (
      this.status === "neutral" ||
      this.status === "starting" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Actions/start] Cannot stop with status of ${this.status}`
      );
    }

    this.status = "stopping";

    await this.triggers.stop();

    await this.actions.stop();

    for (const [jobName] of this.jobs) {
      await this.removeJob(jobName);
    }

    this.status = "neutral";
  }

  public getJobs(): Array<JobItem> {
    return Array.from(this.jobs.values());
  }

  public getJob(jobName: string) {
    return this.jobs.get(jobName);
  }

  public async createJob(payload: Omit<ConfigSchemaType, "version">) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const payloadFull: ConfigSchemaType = {
      ...payload,
      version: null,
    };

    const directory = getPathJobDirectory(payloadFull.name);

    const directories = [
      directory,
      getPathJobLogsDirectory(payloadFull.name),
      getPathJobActionsDirectory(payloadFull.name),
      getPathJobTriggersDirectory(payloadFull.name),
    ];

    await Promise.all(
      directories.map((dir) => mkdir(dir, { recursive: true }))
    );

    this.addJob({
      ...payloadFull,
      directory,
    });

    await Job.writeConfigFile(payloadFull.name, payloadFull);
  }

  public async updateJob(jobName: string, payload: Partial<ConfigSchemaType>) {
    const job = this.jobs.get(jobName);

    assert(job);

    const data = {
      ...job,
      ...payload,
    };

    this.jobs.set(jobName, data);

    await Job.writeConfigFile(jobName, data);
  }

  public async deleteJob(jobName: string) {
    const job = this.jobs.get(jobName);

    assert(job);

    await this.triggers.deleteTriggersByJobName(jobName);
    await this.actions.deleteActionsByJobName(jobName);

    this.removeJob(jobName);

    await Job.deleteConfigFile(jobName);
  }

  public createJobAction = this.actions.createAction.bind(this.actions);
  public deleteJobAction = this.actions.deleteAction.bind(this.actions);
  public getJobActionsByJobName = this.actions.getActionsByJobName.bind(
    this.actions
  );

  public runJobHttpTrigger = this.triggers.runHttpTrigger.bind(this.triggers);
  public createJobTrigger = this.triggers.createTrigger.bind(this.triggers);
  public deleteJobTrigger = this.triggers.deleteTrigger.bind(this.triggers);
  public getJobTriggersByJobName = this.triggers.deleteTriggersByJobName.bind(
    this.actions
  );

  private async addJob(job: JobItem) {
    this.jobs.set(job.name, job);
  }

  private async removeJob(jobName: string) {
    this.jobs.delete(jobName);
  }

  private static async readConfigFile(name: string): Promise<ConfigSchemaType> {
    const filepath = getPathJobConfigFile(name);

    const content = await readFile(filepath, "utf8");

    const contentParsed = JSON.parse(content);

    const contentValidated = await configSchema.parseAsync(contentParsed);

    return contentValidated;
  }

  private static async writeConfigFile(
    name: string,
    content: ConfigSchemaType
  ) {
    const contentValidated = await configSchema.parseAsync(content);

    const directory = getPathJobDirectory(name);

    await mkdir(directory, { recursive: true });

    const filepath = getPathJobConfigFile(name);

    await writeFile(
      filepath,
      JSON.stringify(contentValidated, null, 2),
      "utf8"
    );
  }

  private static async deleteConfigFile(jobName: string) {
    const filename = getPathJobConfigFile(jobName);

    await rm(filename);
  }
}
