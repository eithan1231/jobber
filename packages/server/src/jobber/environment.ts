import assert from "assert";
import { readFile, rm, writeFile } from "fs/promises";
import { z } from "zod";
import { getPathJobEnvironmentFile } from "~/paths.js";
import { Job } from "./job.js";
import { StatusLifecycle } from "./types.js";

const configSchema = z.object({
  jobName: z.string(),

  config: z.record(
    z.string(),
    z.object({
      value: z.string(),
      type: z.enum(["secret", "text"]),
    })
  ),
});

type ConfigSchemaType = z.infer<typeof configSchema>;

export class Environment {
  private job: Job;

  private status: StatusLifecycle = "neutral";

  private environments = new Map<string, ConfigSchemaType>();

  constructor(job: Job) {
    this.job = job;
  }

  public async start() {
    if (
      this.status === "starting" ||
      this.status === "started" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Environment/start] Cannot start with status of ${this.status}`
      );
    }

    this.status = "starting";

    const jobs = this.job.getJobs();

    for (const job of jobs) {
      const config = await Environment.readConfigFile(job.name);

      this.environments.set(config.jobName, config);
    }

    this.status = "started";
  }

  public async stop() {
    if (
      this.status === "neutral" ||
      this.status === "starting" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Environment/stop] Cannot stop with status of ${this.status}`
      );
    }

    this.status = "stopping";

    for (const [id] of this.environments) {
      this.environments.delete(id);
    }

    this.status = "neutral";
  }

  public async createEnvironment(jobName: string) {
    const env = this.environments.get(jobName);

    assert(!env);

    const data = {
      jobName: jobName,
      config: {},
    };

    this.environments.set(data.jobName, data);

    await Environment.writeConfigFile(data.jobName, data);
  }

  public async deleteEnvironment(jobName: string) {
    const env = this.environments.get(jobName);

    assert(env);

    this.environments.delete(jobName);
    await Environment.deleteConfigFile(jobName);
  }

  public getEnvironmentVariables(jobName: string) {
    const environment = this.environments.get(jobName);

    if (!environment) {
      return {};
    }

    return structuredClone(environment.config);
  }

  public async upsertEnvironmentVariable(
    jobName: string,
    name: string,
    value: ConfigSchemaType["config"][string]
  ) {
    const env = this.environments.get(jobName);

    assert(env, new Error(`Failed to find environment for job ${jobName}`));

    const envNew = {
      jobName: env.jobName,
      config: {
        ...env.config,
        [name]: value,
      },
    };

    this.environments.set(jobName, envNew);

    await Environment.writeConfigFile(env.jobName, envNew);
  }

  public async deleteEnvironmentVariable(jobName: string, name: string) {
    const env = this.environments.get(jobName);

    assert(env, new Error(`Failed to find environment for job ${jobName}`));

    // TODO: Revise?
    const envNew = JSON.parse(JSON.stringify(env));
    delete envNew.config[name];

    this.environments.set(jobName, envNew);

    await Environment.writeConfigFile(envNew.jobName, envNew);
  }

  private static async writeConfigFile(
    jobName: string,
    payload: ConfigSchemaType
  ) {
    await writeFile(
      getPathJobEnvironmentFile(jobName),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
  }

  private static async readConfigFile(jobName: string) {
    const content = await readFile(getPathJobEnvironmentFile(jobName), "utf8");

    const contentParsed = JSON.parse(content);

    return await configSchema.parseAsync(contentParsed);
  }

  private static async deleteConfigFile(jobName: string) {
    await rm(getPathJobEnvironmentFile(jobName));
  }
}
