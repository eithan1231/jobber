import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteVersions() {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/versions", createMiddlewareAuth(), async (c, next) => {
    const bouncer = c.get("bouncer")!;
    const jobId = c.req.param("jobId");

    const versions = await getDrizzle()
      .select({
        id: jobVersionsTable.id,
        jobId: jobVersionsTable.jobId,
        version: jobVersionsTable.version,
        created: jobVersionsTable.created,
        modified: jobVersionsTable.modified,
      })
      .from(jobVersionsTable)
      .where(eq(jobVersionsTable.jobId, jobId));

    const versionsFiltered = versions.filter((version) => {
      return bouncer.canReadJobVersion(version);
    });

    return c.json({
      success: true,
      data: versionsFiltered,
    });
  });

  return app;
}
