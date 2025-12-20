import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { rm } from "node:fs/promises";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { jobModel } from "~/db/job.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { logsTable } from "~/db/schema/logs.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { getJobActionArchiveFile } from "~/paths.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJob() {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId", createMiddlewareAuth(), async (c, next) => {
    const bouncer = c.get("bouncer")!;
    const jobId = c.req.param("jobId");

    const job = await getDrizzle()
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
      .limit(1)
      .then((res) => res.at(0));

    if (!job) {
      return next();
    }

    if (!bouncer.canReadJob(job)) {
      return c.text("Insufficient Permissions", 403);
    }

    return c.json({
      success: true,
      data: job,
    });
  });

  app.get("/job/", createMiddlewareAuth(), async (c, _next) => {
    const bouncer = c.get("bouncer")!;

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
      )
      .orderBy(desc(jobVersionsTable.created));

    const jobsFiltered = jobs.filter((job) => {
      return bouncer.canReadJob(job);
    });

    return c.json({
      success: true,
      data: jobsFiltered,
    });
  });

  app.put("/job/:jobId", createMiddlewareAuth(), async (c, _next) => {
    const bouncer = c.get("bouncer")!;
    const jobId = c.req.param("jobId");

    const job = await jobModel.byId(jobId);

    if (!job) {
      return c.json({ success: false, message: "Job not found" }, 404);
    }

    if (!bouncer.canWriteJob(job)) {
      return c.text("Insufficient Permissions", 403);
    }

    const schema = z.object({
      status: z.enum(jobsTable.status.enumValues).optional(),
      description: z.string().optional(),
      jobVersionId: z.string().uuid().nullable().optional(),
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

  app.delete("/job/:jobId", createMiddlewareAuth(), async (c, _next) => {
    const jobId = c.req.param("jobId");
    const bouncer = c.get("bouncer")!;

    const job = await jobModel.byId(jobId);

    if (!job) {
      return c.json({ success: false, message: "Job not found" }, 404);
    }

    if (!bouncer.canDeleteJob(job)) {
      return c.text("Insufficient Permissions", 403);
    }

    // Get all actions and versions, to delete archives after records have been purged.
    const actionArchives = await getDrizzle()
      .select({
        action: actionsTable,
        version: jobVersionsTable,
      })
      .from(actionsTable)
      .where(eq(actionsTable.jobId, job.id))
      .innerJoin(
        jobVersionsTable,
        eq(actionsTable.jobVersionId, jobVersionsTable.id)
      );
    //

    await Promise.all([
      // Delete Jobs
      getDrizzle().delete(jobsTable).where(eq(jobsTable.id, job.id)),

      // Delete Logs (does not have foreign key constraint)
      getDrizzle().delete(logsTable).where(eq(logsTable.jobId, job.id)),
    ]);

    // Delete archive files
    for (const actionArchive of actionArchives) {
      const filename = getJobActionArchiveFile(
        actionArchive.version,
        actionArchive.action
      );

      await rm(filename).catch((err) => {
        if (err.code !== "ENOENT") {
          throw err;
        }
      });
    }

    return c.json({
      success: true,
      message: "ok",
    });
  });

  return app;
}
