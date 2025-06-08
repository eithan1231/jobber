import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { jobsTable } from "~/db/schema/jobs.js";

export async function createRouteJobTriggers() {
  const app = new Hono();

  app.get("/job/:jobId/triggers:latest", async (c, next) => {
    const jobId = c.req.param("jobId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        version: triggersTable.version,
        context: triggersTable.context,
      })
      .from(triggersTable)
      .innerJoin(
        jobsTable,
        and(
          eq(jobsTable.id, triggersTable.jobId),
          eq(jobsTable.version, triggersTable.version)
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
        version: triggersTable.version,
        context: triggersTable.context,
      })
      .from(triggersTable)
      .where(eq(triggersTable.jobId, jobId));

    return c.json({
      success: true,
      data: triggers,
    });
  });

  return app;
}
