import assert from "assert";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { DURATION_HOUR, DURATION_MINUTE } from "~/constants.js";
import {
  getPathJobActionRunnerDirectory,
  getPathJobActionsArchiveFile,
  getPathJobActionsDirectory,
  getPathJobActionsFile,
} from "~/paths.js";
import { createToken } from "~/util.js";
import { Job } from "./job.js";
import { Runners } from "./runners.js";
import { StatusLifecycle } from "./types.js";
import { SendHandleRequest, SendHandleResponse } from "./runner-server.js";

const configSchema = z.object({
  id: z.string(),
  jobName: z.string(),
  version: z.string(),

  /**
   * Can a runner process multiple triggers in parallel. Requests may be dropped if this is false.
   */
  runnerAsynchronous: z.boolean().default(true),

  /**
   * Minimum amount of runners we can have for an action. To avoid cold starts, have this set to 1 or greater.
   */
  runnerMinCount: z.number().min(0).default(0),

  /**
   * Maximum amount of runners we can have for an action.
   */
  runnerMaxCount: z.number().min(0).default(64),

  /**
   * The maximum age in seconds for a runner before gracefully closing it. 0 is infinite.
   */
  runnerMaxAge: z.number().default(DURATION_MINUTE * 15),

  /**
   * The maximum age in seconds for a runner before terminating it. 0 is infinite.
   */
  runnerMaxAgeHard: z.number().default(DURATION_HOUR * 25),

  /**
   * The mode in which to spawn a runner.
   * standard: Creates background jobs, that are scaled up ad-hoc, within the bounds of runnerMinCount and runnerMaxCount.
   * run-once: A new runner will be created for every trigger, and removed immediately after. Useful for Scheduled
   */
  runnerMode: z.enum(["standard", "run-once"]).default("standard"),
});

type ConfigSchemaType = z.infer<typeof configSchema>;

type ActionItem = ConfigSchemaType;

export class Actions {
  private actions = new Map<string, ActionItem>();
  private actionsIndexJobName: Record<string, string[]> = {};

  private job: Job;
  private runners: Runners;

  private status: StatusLifecycle = "neutral";

  constructor(job: Job) {
    this.job = job;

    this.runners = new Runners(job, this);
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

    const jobs = this.job.getJobs();

    for (const job of jobs) {
      const configs = await Actions.readConfigFiles(job.name);

      for (const config of configs) {
        this.addAction(config);
      }
    }

    await this.runners.start();

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

    await this.runners.stop();

    this.status = "neutral";
  }

  public async sendHandleRequest(
    jobName: string,
    payload: SendHandleRequest
  ): Promise<SendHandleResponse> {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const job = this.job.getJob(jobName);
    assert(job);

    const actions = this.getActionsByJobName(job.name);

    const action = actions.find((index) => index.version === job.version);
    if (!action) {
      return {
        success: false,
        duration: 0,
        error: "Jobber: Failed to find latest action versions!",
      };
    }

    return await this.runners.sendHandleRequest(action.id, payload);
  }

  public getAction(actionId: string) {
    const action = this.actions.get(actionId);

    assert(action);

    return action;
  }

  public getActions() {
    return Array.from(this.actions.values());
  }

  public getActionsByJobName(jobName: string) {
    if (!this.actionsIndexJobName[jobName]) {
      return [];
    }

    return this.actionsIndexJobName[jobName].map((actionId) =>
      this.getAction(actionId)
    );
  }

  public async createAction(
    payload: Partial<Omit<ActionItem, "id">>,
    archiveFile: string
  ) {
    console.log(`[Actions/createAction] Creating action ${payload.version}`);

    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const id = createToken({
      prefix: "action",
    });

    const data = await configSchema.parseAsync({ ...payload, id });

    await Actions.copyArchiveFile(data.jobName, data.id, archiveFile);

    this.addAction(data);

    await Actions.writeConfigFile(data.jobName, data);
  }

  public async deleteAction(actionId: string) {
    const action = this.actions.get(actionId);

    assert(action);

    await this.runners.deleteRunnersByActionId(actionId);

    this.removeAction(actionId);

    await Promise.all([
      Actions.deleteConfigFile(action.jobName, action.id),
      Actions.deleteArchiveFile(action.jobName, action.id),
    ]);
  }

  public async deleteActionsByJobName(jobName: string) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    assert(this.actionsIndexJobName[jobName]);

    const actionIds = [...this.actionsIndexJobName[jobName]];

    for (const id of actionIds) {
      await this.deleteAction(id);
    }
  }

  private addAction(payload: ActionItem) {
    this.actions.set(payload.id, payload);

    if (this.actionsIndexJobName[payload.jobName]) {
      this.actionsIndexJobName[payload.jobName].push(payload.id);
    } else {
      this.actionsIndexJobName[payload.jobName] = [payload.id];
    }
  }

  private removeAction(actionId: string) {
    const action = this.actions.get(actionId);

    assert(action);

    this.actions.delete(actionId);

    assert(this.actionsIndexJobName[action.jobName]);

    const index = this.actionsIndexJobName[action.jobName].indexOf(actionId);

    assert(index >= 0);

    const removedIds = this.actionsIndexJobName[action.jobName].splice(
      index,
      1
    );

    assert(removedIds.length === 1);
    assert(removedIds[0] === actionId);

    if (this.actionsIndexJobName[action.jobName].length === 0) {
      delete this.actionsIndexJobName[action.jobName];
    }
  }

  private static async readConfigFiles(jobName: string) {
    const result: ConfigSchemaType[] = [];

    const directory = getPathJobActionsDirectory(jobName);
    const files = await readdir(directory);

    for (const file of files) {
      if (!file.toLowerCase().endsWith(".json")) {
        continue;
      }

      const filename = path.join(directory, file);

      const content = await readFile(filename, "utf8");

      const contentParsed = JSON.parse(content);

      const contentValidated = await configSchema.parseAsync(contentParsed);

      result.push(contentValidated);
    }

    return result;
  }

  private static async writeConfigFile(
    jobName: string,
    content: ConfigSchemaType
  ) {
    const contentValidated = await configSchema.parseAsync(content);

    const directory = getPathJobActionsDirectory(jobName);

    await mkdir(directory, { recursive: true });

    const filename = getPathJobActionsFile(jobName, contentValidated.id);

    await writeFile(filename, JSON.stringify(contentValidated, null, 2));
  }

  private static async deleteConfigFile(jobName: string, actionId: string) {
    const filename = getPathJobActionsFile(jobName, actionId);

    await rm(filename);
  }

  private static async copyArchiveFile(
    jobName: string,
    actionId: string,
    archiveFile: string
  ) {
    const directory = getPathJobActionsDirectory(jobName);

    await mkdir(directory, { recursive: true });

    await cp(archiveFile, getPathJobActionsArchiveFile(jobName, actionId));
  }

  private static async deleteArchiveFile(jobName: string, actionId: string) {
    await rm(getPathJobActionsArchiveFile(jobName, actionId));
  }
}
