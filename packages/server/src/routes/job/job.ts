import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { rm } from "node:fs/promises";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { RunnerManager } from "~/jobber/runners/manager.js";
import { getJobActionArchiveFile } from "~/paths.js";

export async function createRouteJob(runnerManager: RunnerManager) {
  const app = new Hono();

  app.get("/job/:jobId/runners", async (c, next) => {
    const jobId = c.req.param("jobId");

    const job = (
      await getDrizzle().select().from(jobsTable).where(eq(jobsTable.id, jobId))
    ).at(0);

    if (!job) {
      return next();
    }

    const runners = await runnerManager.findRunnersByJobId(jobId);

    return c.json({
      success: true,
      data: runners,
    });
  });

  app.get("/job/:jobId", async (c, next) => {
    const jobId = c.req.param("jobId");

    const job = (
      await getDrizzle()
        .select({
          id: jobsTable.id,
          jobName: jobsTable.jobName,
          description: jobsTable.description,
          jobVersionId: jobsTable.jobVersionId,
          links: jobsTable.links,
          status: jobsTable.status,

          // DEPRECATED: Use jobVersionId instead
          version: jobVersionsTable.version,
        })
        .from(jobsTable)
        .leftJoin(
          jobVersionsTable,
          and(
            eq(jobVersionsTable.jobId, jobsTable.id),
            eq(jobVersionsTable.id, jobsTable.jobVersionId)
          )
        )
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

  app.get("/job/", async (c, _next) => {
    const jobs = await getDrizzle()
      .select({
        id: jobsTable.id,
        jobName: jobsTable.jobName,
        jobVersionId: jobsTable.jobVersionId,
        description: jobsTable.description,
        links: jobsTable.links,
        status: jobsTable.status,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(jobsTable)
      .leftJoin(
        jobVersionsTable,
        and(
          eq(jobVersionsTable.jobId, jobsTable.id),
          eq(jobVersionsTable.id, jobsTable.jobVersionId)
        )
      );

    return c.json({
      success: true,
      data: jobs,
    });
  });

  app.put("/job/:jobId", async (c, _next) => {
    const jobId = c.req.param("jobId");

    const schema = z.object({
      status: z.enum(jobsTable.status.enumValues).optional(),
      description: z.string().optional(),
    });

    const body = await schema.parseAsync(await c.req.json(), {
      path: ["request", "body"],
    });

    await getDrizzle()
      .update(jobsTable)
      .set(body)
      .where(eq(jobsTable.id, jobId));

    return c.json({
      success: true,
      message: "ok",
    });
  });

  app.delete("/job/:jobId", async (c, _next) => {
    const jobId = c.req.param("jobId");

    const actionsDeleted = await getDrizzle()
      .delete(actionsTable)
      .where(eq(actionsTable.jobId, jobId))
      .returning();

    for (const actionDeleted of actionsDeleted) {
      const jobVersionDeleted = await getDrizzle()
        .delete(jobVersionsTable)
        .where(eq(jobVersionsTable.id, actionDeleted.jobVersionId))
        .returning();

      const deletedVersion = jobVersionDeleted.at(0);

      if (!deletedVersion) {
        continue;
      }

      const filename = getJobActionArchiveFile(deletedVersion, actionDeleted);

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
