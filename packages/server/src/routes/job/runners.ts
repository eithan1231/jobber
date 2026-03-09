import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { container } from "tsyringe";
import { getDrizzle } from "~/db/index.js";
import { jobModel } from "~/db/job.js";
import { jobsTable } from "~/db/schema.js";
import { InternalHonoApp } from "~/index.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "@jobber/common/permissions.js";
import { runnersModel } from "~/db/runners.js";
import { create } from "domain";

export async function createRouteJobRunners() {
  const runnerManager = container.resolve(RunnerManager);

  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/runners", createMiddlewareAuth(), async (c, next) => {
    const jobId = c.req.param("jobId");
    const bouncer = c.get("bouncer")!;
    const job = await jobModel.byId(jobId);

    if (!job) {
      return next();
    }

    if (!bouncer.canReadJobRunners(job)) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const runners = await runnersModel.byJobIdSpecial(jobId, true);

    return c.json({
      success: true,
      data: runners.map((runner) => ({
        id: runner.id,
        status: runner.status,
        actionId: runner.actionId,
        jobId: runner.jobId,
        requestsProcessing: 0,
        createdAt: Math.floor(runner.createdAt.getTime() / 1000),
        readyAt: Math.floor(runner.readyAt?.getTime() ?? 0 / 1000),
        closingAt: Math.floor(runner.closingAt?.getTime() ?? 0 / 1000),
        closedAt: Math.floor(runner.closedAt?.getTime() ?? 0 / 1000),
      })),
    });
  });

  app.delete(
    "/job/:jobId/runners/:runnerId",
    createMiddlewareAuth(),
    async (c, next) => {
      const bouncer = c.get("bouncer")!;
      const jobId = c.req.param("jobId");
      const runnerId = c.req.param("runnerId");
      const queryShutdownForcefully = c.req.query("forceful") === "true";
      const job = await jobModel.byId(jobId);

      if (!job) {
        return next();
      }

      if (!bouncer.canWriteJobRunners(job)) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403,
        );
      }

      runnerManager.shutdownQueueAdd(runnerId, !!queryShutdownForcefully);

      return c.json(
        {
          success: true,
          message: "Scheduled for shutdown",
        },
        200,
      );
    },
  );

  return app;
}
