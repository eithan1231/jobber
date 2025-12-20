import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { register } from "prom-client";
import { container } from "tsyringe";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { InternalHonoApp } from "~/index.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { Telemetry } from "~/jobber/telemetry.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";
import { getUnixTimestamp } from "~/util.js";

export async function createRouteMetrics() {
  const runnerManager = container.resolve(RunnerManager);
  const app = new Hono<InternalHonoApp>();

  app.get("/metrics", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canReadSystemMetricsPrometheus()) {
      return c.text("Insufficient Permissions", 403);
    }

    c.header("Content-Type", register.contentType);
    return c.text(await register.metrics(), 200);
  });

  app.get("/metrics/overview", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canReadSystemMetricsOverview()) {
      return c.text("Insufficient Permissions", 403);
    }

    const telemetry = container.resolve(Telemetry);

    const runners = await runnerManager.getRunners();

    const runnersTotal = runners.length;

    const runnersStarting = runners.reduce((count, runner) => {
      if (runner.status === "starting") {
        return count + 1;
      }

      return count;
    }, 0);

    const runnersReady = runners.reduce((count, runner) => {
      if (runner.status === "ready") {
        return count + 1;
      }

      return count;
    }, 0);

    const runnersClosing = runners.reduce((count, runner) => {
      if (runner.status === "closing") {
        return count + 1;
      }

      return count;
    }, 0);

    const runnersClosed = runners.reduce((count, runner) => {
      if (runner.status === "closed") {
        return count + 1;
      }

      return count;
    }, 0);

    const runnersLoadTotal = runners.reduce((total, runner) => {
      return total + runner.requestsProcessing;
    }, 0);

    const runnersLoadAverage =
      runnersLoadTotal === 0 ? 0 : runnersLoadTotal / runnersTotal;

    const lastRequestAt = runners.reduce((latest, runner) => {
      if (runner.lastRequestAt && runner.lastRequestAt > latest) {
        return runner.lastRequestAt;
      }

      return latest;
    }, 0);

    const jobsTotal = await getDrizzle()
      .select({
        count: sql`COUNT(${jobsTable.id})`,
      })
      .from(jobsTable)
      .then((res) => res[0].count as number);
    //

    const jobsDisabled = await getDrizzle()
      .select({
        count: sql`COUNT(${jobsTable.id})`,
      })
      .from(jobsTable)
      .where(eq(jobsTable.status, "disabled"))
      .then((res) => res[0].count as number);
    //

    const jobsEnabled = await getDrizzle()
      .select({
        count: sql`COUNT(${jobsTable.id})`,
      })
      .from(jobsTable)
      .where(eq(jobsTable.status, "enabled"))
      .then((res) => res[0].count as number);
    //

    return c.json({
      success: true,
      data: {
        runnerMetrics: {
          runnersTotal,
          runnersStarting,
          runnersReady,
          runnersClosing,
          runnersClosed,

          runnersLoadTotal,
          runnersLoadAverage,

          lastRequestAt,
        },

        jobsMetrics: {
          jobsTotal,
          jobsDisabled,
          jobsEnabled,
        },

        uptime: getUnixTimestamp() - telemetry.getStartTime(),
      },
    });
  });

  return app;
}
