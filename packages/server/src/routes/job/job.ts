import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { rm } from "node:fs/promises";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { getJobActionArchiveFile } from "~/paths.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJob() {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId", createMiddlewareAuth(), async (c, next) => {
    const jobId = c.req.param("jobId");
    const auth = c.get("auth")!;

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

    if (!canPerformAction(auth.permissions, `job/${job.id}`, "read")) {
      return c.text("Insufficient Permissions", 403);
    }

    return c.json({
      success: true,
      data: job,
    });
  });

  app.get("/job/", createMiddlewareAuth(), async (c, _next) => {
    const auth = c.get("auth")!;

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

    const jobsFiltered = jobs.filter((job) => {
      return canPerformAction(auth.permissions, `job/${job.id}`, "read");
    });

    return c.json({
      success: true,
      data: jobsFiltered,
    });
  });

  app.put("/job/:jobId", createMiddlewareAuth(), async (c, _next) => {
    const jobId = c.req.param("jobId");
    const auth = c.get("auth")!;

    // TODO: Update to fetch from database, to compare jobId against the database record, not user input.
    if (
      !canPerformAction(auth.permissions, `job/${jobId.toLowerCase()}`, "write")
    ) {
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
    const auth = c.get("auth")!;

    // TODO: Update to fetch from database, to compare jobId against the database record, not user input.
    if (
      !canPerformAction(
        auth.permissions,
        `job/${jobId.toLowerCase()}`,
        "delete"
      )
    ) {
      return c.text("Insufficient Permissions", 403);
    }

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
