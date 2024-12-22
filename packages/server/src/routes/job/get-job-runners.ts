import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { RunnerManager } from "~/jobber/runners/manager.js";

export async function createRouteGetJobRunners(runnerManager: RunnerManager) {
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

  return app;
}
