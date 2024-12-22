import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { triggersTable } from "~/db/schema/triggers.js";

export async function createRouteGetTriggers() {
  const app = new Hono();

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
