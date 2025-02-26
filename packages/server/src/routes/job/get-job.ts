import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";

export async function createRouteGetJob() {
  const app = new Hono();

  app.get("/job/:jobId", async (c, next) => {
    const jobId = c.req.param("jobId");

    const job = (
      await getDrizzle()
        .select({
          id: jobsTable.id,
          jobName: jobsTable.jobName,
          description: jobsTable.description,
          version: jobsTable.version,
          links: jobsTable.links,
          status: jobsTable.status,
        })
        .from(jobsTable)
        .where(eq(jobsTable.id, jobId))
    ).at(0);

    if (!job) {
      return next();
    }

    return c.json({
      success: true,
      data: job,
    });
  });

  return app;
}
