import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
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
        jobVersionId: actionsTable.jobVersionId,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxAge: actionsTable.runnerMaxAge,
        runnerMaxAgeHard: actionsTable.runnerMaxAgeHard,
        runnerDockerArguments: actionsTable.runnerDockerArguments,
        runnerMode: actionsTable.runnerMode,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(actionsTable)
      .innerJoin(
        jobsTable,
        and(
          eq(jobsTable.id, actionsTable.jobId),
          eq(jobsTable.jobVersionId, actionsTable.jobVersionId)
        )
      )
      .innerJoin(
        jobVersionsTable,
        and(
          eq(jobVersionsTable.jobId, actionsTable.jobId),
          eq(jobVersionsTable.id, actionsTable.jobVersionId)
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
        jobVersionId: actionsTable.jobVersionId,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxAge: actionsTable.runnerMaxAge,
        runnerMaxAgeHard: actionsTable.runnerMaxAgeHard,
        runnerDockerArguments: actionsTable.runnerDockerArguments,
        runnerMode: actionsTable.runnerMode,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(actionsTable)
      .innerJoin(
        jobVersionsTable,
        and(
          eq(jobVersionsTable.jobId, actionsTable.jobId),
          eq(jobVersionsTable.id, actionsTable.jobVersionId)
        )
      )
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
