import { eq } from "drizzle-orm";
import { rm } from "fs/promises";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { getJobActionArchiveFile } from "~/paths.js";

export async function createRouteDeleteJob() {
  const app = new Hono();

  app.delete("/job/:jobId", async (c, _next) => {
    const jobId = c.req.param("jobId");

    const actionsDeleted = await getDrizzle()
      .delete(actionsTable)
      .where(eq(actionsTable.jobId, jobId))
      .returning();

    for (const actionDeleted of actionsDeleted) {
      const filename = getJobActionArchiveFile(actionDeleted);

      await rm(filename);
    }

    await getDrizzle().delete(jobsTable).where(eq(jobsTable.id, jobId));

    return c.json({
      success: true,
      message: "ok",
    });
  });

  return app;
}
