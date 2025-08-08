import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { InternalHonoApp } from "~/index.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJobRunners(runnerManager: RunnerManager) {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/runners", createMiddlewareAuth(), async (c, next) => {
    const jobId = c.req.param("jobId");
    const auth = c.get("auth")!;

    const job = await getDrizzle()
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1)
      .then((res) => res.at(0));

    if (!job) {
      return next();
    }

    if (!canPerformAction(auth.permissions, `job/${job.id}/runners`, "read")) {
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
      const auth = c.get("auth")!;

      const jobId = c.req.param("jobId");
      const runnerId = c.req.param("runnerId");
      const queryShutdownForcefully = c.req.query("forceful") === "true";

      const job = await getDrizzle()
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, jobId))
        .limit(1)
        .then((res) => res.at(0));

      if (!job) {
        return next();
      }

      if (
        !canPerformAction(auth.permissions, `job/${job.id}/runners`, "write")
      ) {
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
