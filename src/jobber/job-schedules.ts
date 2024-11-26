import { CronTime } from "cron";
import { randomBytes } from "crypto";

type JobSchedule = {
  jobName: string;
  id: string;

  cronTime: CronTime;
  runAt: number;

  timezone?: string;
  cron: string;
};

export type JobSchedulerHandleEvent = (jobName: string) => void;

export class JobScheduler {
  private interval: NodeJS.Timeout | null = null;

  private schedules: Map<string, JobSchedule> = new Map();

  private onHandleEvent: null | JobSchedulerHandleEvent = null;

  public registerHandleEvent(handler: JobSchedulerHandleEvent) {
    this.onHandleEvent = handler;
  }

  private onTick() {
    const timestamp = Date.now();

    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (schedule.runAt > timestamp) {
        continue;
      }

      console.log(
        `[Job/eventScheduleTick] Running schedule ${schedule.jobName}, runAt ${schedule.runAt}, jobExecutionConditionId ${schedule.id}`
      );

      this.schedules.set(scheduleId, {
        ...schedule,
        runAt: schedule.cronTime.sendAt().toMillis(),
      });

      if (this.onHandleEvent) {
        this.onHandleEvent(schedule.jobName);
      }
    }
  }

  public start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.onTick();
    }, 1000);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public createSchedule(
    payload: Pick<JobSchedule, "jobName" | "timezone" | "cron">
  ) {
    const id = randomBytes(16).toString("hex");

    const cronTime = new CronTime(payload.cron, payload.timezone);

    this.schedules.set(id, {
      ...payload,
      id,
      cronTime,
      runAt: cronTime.sendAt().toMillis(),
    });
  }

  public deleteSchedulesByJobName(jobName: string) {
    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (schedule.jobName === jobName) {
        this.schedules.delete(scheduleId);
      }
    }
  }
}
