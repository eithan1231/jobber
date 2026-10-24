import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { container } from "tsyringe";
import { getDrizzle } from "~/db/index.js";
import { jobModel } from "~/db/job.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { InternalHonoApp } from "~/index.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { parseRequestParam } from "~/errors.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";
import { runnerIdSchema } from "./schemas-common.js";

export async function createRouteJobRunners() {
  const runnerManager = container.resolve(RunnerManager);

  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/runners", createMiddlewareAuth(), async (c, next) => {
    const jobId = parseRequestParam(c, "jobId", z.guid());
    const bouncer = c.get("bouncer")!;

    const job = await jobModel.byId(jobId);

    if (!job) {
      return next();
    }

    if (!bouncer.canReadJobRunners(job)) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403
      );
    }

    const runners = await runnerManager.findRunnersByJobId(jobId);

    return c.json({
      success: true,
      data: runners,
    });
  });

  app.delete(
    "/job/:jobId/runners/:runnerId",
    createMiddlewareAuth(),
    async (c, next) => {
      const bouncer = c.get("bouncer")!;

      const jobId = parseRequestParam(c, "jobId", z.guid());
      const runnerId = parseRequestParam(c, "runnerId", runnerIdSchema);
      const queryShutdownForcefully = c.req.query("forceful") === "true";

      const job = await jobModel.byId(jobId);

      if (!job) {
        return next();
      }

      if (!bouncer.canWriteJobRunners(job)) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      let result;

      if (queryShutdownForcefully) {
        result = await runnerManager.sendShutdownForceful(job.id, runnerId);
      } else {
        result = await runnerManager.sendShutdownGraceful(job.id, runnerId);
      }

      return c.json(
        {
          success: result.success,
          message: result.message,
        },
        result.success ? 200 : 400
      );
    }
  );

  return app;
}
