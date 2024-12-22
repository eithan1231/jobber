import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";

export async function createRouteGetJobs() {
  const app = new Hono();

  app.get("/job/", async (c, next) => {
    const jobs = await getDrizzle()
      .select({
        id: jobsTable.id,
        jobName: jobsTable.jobName,
        description: jobsTable.description,
        version: jobsTable.version,
        links: jobsTable.links,
      })
      .from(jobsTable);

    return c.json({
      success: true,
      data: jobs,
    });
  });

  return app;
}
