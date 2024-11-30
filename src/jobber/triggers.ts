import assert from "assert";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import {
  getPathJobTriggersDirectory,
  getPathJobTriggersFile,
} from "~/paths.js";
import { createToken } from "~/util.js";
import { Job } from "./job.js";
import { StatusLifecycle } from "./types.js";
import { CronTime } from "cron";
import {
  SendHandleRequest,
  SendHandleRequestHttp,
  SendHandleResponse,
} from "./runner-server.js";

const configSchema = z.object({
  id: z.string(),
  jobName: z.string(),
  version: z.string(),

  context: z.union([
    z.object({
      type: z.literal("schedule"),
      cron: z.string(),
      timezone: z.string().optional(),
    }),
    z.object({
      type: z.literal("http"),
    }),
  ]),
});

type ConfigSchemaType = z.infer<typeof configSchema>;

type TriggerItem = ConfigSchemaType & {
  schedule?: {
    cronTime: CronTime;
    runAt: number;
  };
};

export type TriggersHandleEvent = (
  jobName: string,
  request: SendHandleRequest
) => Promise<SendHandleResponse>;

export class Triggers {
  private triggers = new Map<string, TriggerItem>();

  private triggersIndexJobName: Record<string, string[]> = {};

  private job: Job;

  private status: StatusLifecycle = "neutral";

  private intervalSchedule: NodeJS.Timeout | null = null;

  private onHandleEvent: null | TriggersHandleEvent = null;

  public registerHandleEvent(handler: TriggersHandleEvent) {
    this.onHandleEvent = handler;
  }

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
        `[Triggers/start] Cannot start with status of ${this.status}`
      );
    }

    this.status = "starting";

    const jobs = this.job.getJobs();

    for (const job of jobs) {
      const configs = await Triggers.readConfigFiles(job.name);

      for (const config of configs) {
        this.addTrigger(config);
      }
    }

    this.intervalSchedule = setInterval(() => this.onScheduleTick(), 1000);

    this.status = "started";
  }

  public async stop() {
    if (
      this.status === "neutral" ||
      this.status === "starting" ||
      this.status === "stopping"
    ) {
      throw new Error(
        `[Triggers/start] Cannot stop with status of ${this.status}`
      );
    }

    this.status = "stopping";

    for (const [id] of this.triggers) {
      this.removeTrigger(id);
    }

    if (this.intervalSchedule) {
      clearInterval(this.intervalSchedule);
    }

    this.status = "neutral";
  }

  public async runHttpTrigger(
    jobName: string,
    request: SendHandleRequestHttp
  ): Promise<SendHandleResponse> {
    const job = this.job.getJob(jobName);
    const triggers = this.getTriggersByJobName(jobName);

    if (!job || triggers.length <= 0) {
      console.warn();

      return {
        success: false,
        duration: 0,
        error: "Jobber: Generic failure",
      };
    }

    const canRun = triggers.some(
      (index) => index.context.type === "http" && index.version === job.version
    );

    if (!canRun) {
      return {
        success: false,
        duration: 0,
        error: "Jobber: Generic failure",
      };
    }

    assert(this.onHandleEvent);

    return await this.onHandleEvent(jobName, request);
  }

  public getTrigger(triggerId: string) {
    const action = this.triggers.get(triggerId);

    assert(action);

    return action;
  }

  public getTriggers() {
    return Array.from(this.triggers.values());
  }

  public getTriggersByJobName(jobName: string) {
    if (!this.triggersIndexJobName[jobName]) {
      return [];
    }

    return this.triggersIndexJobName[jobName].map((triggerId) =>
      this.getTrigger(triggerId)
    );
  }

  public async createTrigger(payload: Partial<Omit<ConfigSchemaType, "id">>) {
    console.log(`[Triggers/createTrigger] Creating trigger ${payload.version}`);

    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const id = createToken({
      prefix: "trigger",
    });

    const data = await configSchema.parseAsync({ ...payload, id });

    this.addTrigger(data);

    await Triggers.writeConfigFile(data.jobName, data);
  }

  public async deleteTrigger(triggerId: string) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    const trigger = this.triggers.get(triggerId);

    assert(trigger);

    this.removeTrigger(triggerId);

    await Triggers.deleteConfigFile(trigger.jobName, trigger.id);
  }

  public async deleteTriggersByJobName(jobName: string) {
    if (this.status !== "started") {
      throw new Error("Class has to be started");
    }

    assert(this.triggersIndexJobName[jobName]);

    for (const id of this.triggersIndexJobName[jobName]) {
      await this.deleteTrigger(id);
    }
  }

  private addTrigger(payload: ConfigSchemaType) {
    const item = {
      ...payload,
    } as TriggerItem;

    if (item.context.type === "schedule") {
      const cronTime = new CronTime(item.context.cron, item.context.timezone);

      item.schedule = {
        cronTime,
        runAt: cronTime.sendAt().toMillis(),
      };
    }

    this.triggers.set(item.id, item);

    if (this.triggersIndexJobName[item.jobName]) {
      this.triggersIndexJobName[item.jobName].push(item.id);
    } else {
      this.triggersIndexJobName[item.jobName] = [item.id];
    }
  }

  private removeTrigger(triggerId: string) {
    const action = this.triggers.get(triggerId);

    assert(action);

    this.triggers.delete(triggerId);

    assert(this.triggersIndexJobName[action.jobName]);

    const index = this.triggersIndexJobName[action.jobName].indexOf(triggerId);

    assert(index >= 0);

    const removedIds = this.triggersIndexJobName[action.jobName].splice(
      index,
      1
    );

    assert(removedIds.length === 1);
    assert(removedIds[0] === triggerId);

    if (this.triggersIndexJobName[action.jobName].length === 0) {
      delete this.triggersIndexJobName[action.jobName];
    }
  }

  private onScheduleTick = () => {
    const timestamp = Date.now();

    // WARNING: Don't make this function asynchronous. We iterate over the triggers, and immediately
    // update then with the value we iterate with. If this was an asynchronous method, it would open
    // it to race conditions. Bad. Bad. Bad.

    for (const [triggerId, trigger] of this.triggers) {
      const job = this.job.getJob(trigger.jobName);

      assert(job);

      if (trigger.version !== job.version) {
        continue;
      }

      if (!trigger.schedule || trigger.context.type !== "schedule") {
        continue;
      }

      if (trigger.schedule.runAt > timestamp) {
        continue;
      }

      console.log(
        `[Triggers/onScheduleTick] Schedule starting ${trigger.jobName}, runAt ${trigger.schedule.runAt}`
      );

      this.triggers.set(triggerId, {
        ...trigger,
        schedule: {
          cronTime: trigger.schedule.cronTime,
          runAt: trigger.schedule.cronTime.sendAt().toMillis(),
        },
      });

      if (this.onHandleEvent) {
        this.onHandleEvent(trigger.jobName, {
          type: "schedule",
        });
      }
    }
  };

  private static async readConfigFiles(jobName: string) {
    const result: ConfigSchemaType[] = [];

    const directory = getPathJobTriggersDirectory(jobName);
    const files = await readdir(directory);

    for (const file of files) {
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

    const directory = getPathJobTriggersDirectory(jobName);

    await mkdir(directory, { recursive: true });

    const filename = getPathJobTriggersFile(jobName, contentValidated.id);

    await writeFile(filename, JSON.stringify(contentValidated, null, 2));
  }

  private static async deleteConfigFile(jobName: string, triggerId: string) {
    const filename = getPathJobTriggersFile(jobName, triggerId);

    await rm(filename);
  }
}
