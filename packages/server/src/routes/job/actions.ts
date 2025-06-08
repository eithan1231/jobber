import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { RunnerManager } from "~/jobber/runners/manager.js";

export async function createRouteJobActions(runnerManager: RunnerManager) {
  const app = new Hono();

  app.get("/job/:jobId/actions:latest", async (c, next) => {
    const jobId = c.req.param("jobId");

    const actions = await getDrizzle()
      .select({
        id: actionsTable.id,
        jobId: actionsTable.jobId,
        version: actionsTable.version,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxAge: actionsTable.runnerMaxAge,
        runnerMaxAgeHard: actionsTable.runnerMaxAgeHard,
        runnerMode: actionsTable.runnerMode,
      })
      .from(actionsTable)
      .innerJoin(
        jobsTable,
        and(
          eq(jobsTable.id, actionsTable.jobId),
          eq(jobsTable.version, actionsTable.version)
        )
      )
      .where(eq(actionsTable.jobId, jobId));

    return c.json({
      success: true,
      data: actions,
    });
  });

  app.get("/job/:jobId/actions", async (c, next) => {
    const jobId = c.req.param("jobId");

    const actions = await getDrizzle()
      .select({
        id: actionsTable.id,
        jobId: actionsTable.jobId,
        version: actionsTable.version,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxAge: actionsTable.runnerMaxAge,
        runnerMaxAgeHard: actionsTable.runnerMaxAgeHard,
        runnerMode: actionsTable.runnerMode,
      })
      .from(actionsTable)
      .where(eq(actionsTable.jobId, jobId));

    return c.json({
      success: true,
      data: actions,
    });
  });

  app.get("/job/:jobId/actions/:actionId/runners", async (c, next) => {
    const jobId = c.req.param("jobId");
    const actionId = c.req.param("actionId");

    const job = (
      await getDrizzle().select().from(jobsTable).where(eq(jobsTable.id, jobId))
    ).at(0);

    if (!job) {
      return next();
    }

    const runners = await runnerManager.findRunnersByActionId(actionId);

    return c.json({
      success: true,
      data: runners,
    });
  });

  return app;
}
