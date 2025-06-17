import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { RunnerManager } from "~/jobber/runners/manager.js";

export async function createRouteJobRunners(runnerManager: RunnerManager) {
  const app = new Hono();

  app.get("/job/:jobId/runners", async (c, next) => {
    const jobId = c.req.param("jobId");

    const job = (
      await getDrizzle().select().from(jobsTable).where(eq(jobsTable.id, jobId))
    ).at(0);

    if (!job) {
      return next();
    }

    const runners = await runnerManager.findRunnersByJobId(jobId);

    return c.json({
      success: true,
      data: runners,
    });
  });

  app.delete("/job/:jobId/runners/:runnerId", async (c, next) => {
    const jobId = c.req.param("jobId");
    const runnerId = c.req.param("runnerId");
    const queryShutdownForcefully = c.req.query("forceful") === "true";

    const job = (
      await getDrizzle().select().from(jobsTable).where(eq(jobsTable.id, jobId))
    ).at(0);

    if (!job) {
      return next();
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
  });

  return app;
}
