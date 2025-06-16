import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";

export async function createRouteJobTriggers() {
  const app = new Hono();

  app.get("/job/:jobId/triggers:current", async (c, next) => {
    const jobId = c.req.param("jobId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        jobVersionId: triggersTable.jobVersionId,
        context: triggersTable.context,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(jobsTable)
      .innerJoin(
        triggersTable,
        and(
          eq(jobsTable.id, triggersTable.jobId),
          eq(jobsTable.jobVersionId, triggersTable.jobVersionId)
        )
      )
      .innerJoin(
        jobVersionsTable,
        and(
          eq(jobVersionsTable.jobId, triggersTable.jobId),
          eq(jobVersionsTable.id, triggersTable.jobVersionId)
        )
      )
      .where(eq(triggersTable.jobId, jobId));

    return c.json({
      success: true,
      data: triggers,
    });
  });

  app.get("/job/:jobId/triggers", async (c, next) => {
    const jobId = c.req.param("jobId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        jobVersionId: triggersTable.jobVersionId,
        context: triggersTable.context,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(triggersTable)
      .innerJoin(
        jobVersionsTable,
        and(
          eq(triggersTable.jobId, jobVersionsTable.jobId),
          eq(triggersTable.jobVersionId, jobVersionsTable.id)
        )
      )
      .where(eq(triggersTable.jobId, jobId));

    return c.json({
      success: true,
      data: triggers,
    });
  });

  return app;
}
