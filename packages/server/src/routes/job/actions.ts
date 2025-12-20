import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";

export async function createRouteJobActions() {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/actions:current", createMiddlewareAuth(), async (c) => {
    const jobId = c.req.param("jobId");
    const bouncer = c.get("bouncer")!;

    const actions = await getDrizzle()
      .select({
        id: actionsTable.id,
        jobId: actionsTable.jobId,
        jobVersionId: actionsTable.jobVersionId,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxIdleAge: actionsTable.runnerMaxIdleAge,
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

    const actionsFiltered = actions.filter((action) => {
      return bouncer.canReadJobAction(action);
    });

    return c.json({
      success: true,
      data: actionsFiltered,
    });
  });

  app.get("/job/:jobId/actions", createMiddlewareAuth(), async (c) => {
    const jobId = c.req.param("jobId");
    const bouncer = c.get("bouncer")!;

    const actions = await getDrizzle()
      .select({
        id: actionsTable.id,
        jobId: actionsTable.jobId,
        jobVersionId: actionsTable.jobVersionId,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxIdleAge: actionsTable.runnerMaxIdleAge,
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

    const actionsFiltered = actions.filter((action) => {
      return bouncer.canReadJobAction(action);
    });

    return c.json({
      success: true,
      data: actionsFiltered,
    });
  });

  return app;
}
