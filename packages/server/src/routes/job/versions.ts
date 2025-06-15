import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";

export async function createRouteVersions() {
  const app = new Hono();

  app.get("/job/:jobId/versions", async (c, next) => {
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

    return c.json({
      success: true,
      data: versions,
    });
  });

  return app;
}
