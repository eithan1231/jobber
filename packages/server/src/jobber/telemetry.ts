import { eq, sql } from "drizzle-orm";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { storeTable } from "~/db/schema/store.js";
import { LoopBase } from "~/loop-base.js";
import { gaugeJobStoreCount, gaugeAppInfo, gaugeJobsInfo } from "~/metrics.js";

export class Telemetry extends LoopBase {
  protected loopDuration = 1000;
  protected loopShutdown = undefined;

  private startTime: number;

  constructor(startTime: number) {
    super();

    this.startTime = startTime;
  }

  protected async loopStartup() {
    this.gaugeAppInfo();
  }

  protected async loopIteration() {
    await this.counterJobStoreCount();
    await this.gaugeJobsInfo();
  }

  private gaugeAppInfo() {
    gaugeAppInfo.set(
      {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        start_time: this.startTime.toString(),
      },
      1
    );
  }

  private async counterJobStoreCount() {
    try {
      const records = await getDrizzle()
        .select({
          jobId: jobsTable.id,
          jobName: jobsTable.jobName,
          count: sql`COUNT(${storeTable.id})`,
        })
        .from(jobsTable)
        .leftJoin(storeTable, eq(jobsTable.id, storeTable.jobId))
        .groupBy(jobsTable.id, jobsTable.jobName);

      for (const record of records) {
        const count = Number(record.count);

        if (isNaN(count)) {
          continue;
        }

        gaugeJobStoreCount
          .labels({
            job_id: record.jobId,
            job_name: record.jobName,
          })
          .set(count);
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async gaugeJobsInfo() {
    try {
      const jobs = await getDrizzle()
        .select({
          id: jobsTable.id,
          jobName: jobsTable.jobName,
          status: jobsTable.status,
        })
        .from(jobsTable);

      // This is risky, and could introduce race conditions if Prometheus is
      // scraping while we are updating this gauge.
      gaugeJobsInfo.reset();

      for (const job of jobs) {
        gaugeJobsInfo
          .labels({
            job_id: job.id,
            job_name: job.jobName,
            status: job.status ?? "",
          })
          .set(1);
      }
    } catch (err) {
      console.error(err);
    }
  }
}
