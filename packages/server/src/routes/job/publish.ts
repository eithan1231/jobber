import assert from "assert";
import { and, eq } from "drizzle-orm";
import { createWriteStream } from "fs";
import { cp } from "fs/promises";
import { Hono } from "hono";
import { setMetric, timing } from "hono/timing";
import { ReadableStream } from "node:stream/web";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { classifyArchiveFile } from "~/jobber/images.js";
import { getJobActionArchiveFile } from "~/paths.js";
import {
  createBenchmark,
  getTmpFile,
  handleReadableStreamPipe,
} from "~/util.js";

export async function createRouteJobPublish() {
  const app = new Hono();

  app.post("/job/publish/", async (c, _next) => {
    const benchmark = createBenchmark();

    console.log(`[/publish/] ${benchmark()}ms - Starting job publish`);

    const body = await c.req.parseBody();

    console.log(`[/publish/] ${benchmark()}ms - Parsed request body`);

    const archiveFile = body["archive"];

    if (!(archiveFile instanceof File)) {
      console.log("[/publish/] archive not present on body, or invalid type");

      return c.json(
        {
          success: false,
          message: "Expected file",
        },
        400
      );
    }

    if (!archiveFile.type.toLowerCase().startsWith("application/zip")) {
      console.log("[/publish] archive has invalid mime type");

      return c.json(
        {
          success: false,
          message: "Unexpected file type",
        },
        400
      );
    }

    const filename = getTmpFile({ extension: "zip" });
    const writeStream = createWriteStream(filename);

    await handleReadableStreamPipe(
      archiveFile.stream() as ReadableStream,
      writeStream
    );

    console.log(`[/publish/] ${benchmark()}ms - File streamed to disk`);

    const classification = await classifyArchiveFile(filename);

    if (!classification) {
      return c.json(
        {
          success: false,
          message: "Malformed archive file!",
        },
        400
      );
    }

    console.log(`[/publish/] ${benchmark()}ms - File classified`);

    // TODO: Support for other runtimes.
    assert(classification.type === "node");

    const packageJson = classification.package;

    const existingJob = (
      await getDrizzle()
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.jobName, packageJson.name))
        .limit(1)
    ).at(0);

    if (!existingJob) {
      await getDrizzle().insert(jobsTable).values({
        jobName: packageJson.name,
        description: packageJson.description,
        links: packageJson.links,
      });
    }

    console.log(`[/publish/] ${benchmark()}ms - Queried job`);

    return await getDrizzle().transaction(async (tx) => {
      const job = (
        await getDrizzle()
          .insert(jobsTable)
          .values({
            jobName: packageJson.name,
            description: packageJson.description,
            links: packageJson.links,
          })
          .onConflictDoUpdate({
            set: {
              description: packageJson.description,
              links: packageJson.links,
              version: packageJson.version,
            },
            target: jobsTable.jobName,
          })
          .returning()
      ).at(0);

      if (!job) {
        tx.rollback();

        return c.json({
          success: false,
          message: "Creation failed",
        });
      }

      console.log(`[/publish/] ${benchmark()}ms - Upserted job`);

      const existingActions = await tx
        .select()
        .from(actionsTable)
        .where(
          and(
            eq(actionsTable.jobId, job.id),
            eq(actionsTable.version, packageJson.version)
          )
        );

      if (existingActions.length > 0) {
        console.log(
          `[${c.req.path}] Failed due to pre-existing actions with the same version`
        );

        return c.json(
          {
            success: false,
            message: "Cannot re-publish version",
          },
          400
        );
      }

      const existingTriggers = await tx
        .select()
        .from(triggersTable)
        .where(
          and(
            eq(triggersTable.jobId, job.id),
            eq(triggersTable.version, packageJson.version)
          )
        );

      if (existingTriggers.length > 0) {
        console.log(
          `[${c.req.path}] Failed due to pre-existing triggers with the same version`
        );

        return c.json(
          {
            success: false,
            message: "Cannot re-publish version",
          },
          400
        );
      }

      const actions = await tx
        .insert(actionsTable)
        .values({
          jobId: job.id,
          version: packageJson.version,
          runnerImage: classification.image.name,
          runnerAsynchronous: packageJson.action.runnerAsynchronous,
          runnerMaxAge: packageJson.action.runnerMaxAge,
          runnerMaxAgeHard: packageJson.action.runnerMaxAgeHard,
          runnerMaxCount: packageJson.action.runnerMaxCount,
          runnerMinCount: packageJson.action.runnerMinCount,
          runnerMode: packageJson.action.runnerMode,
          runnerTimeout: packageJson.action.runnerTimeout,
        })
        .returning();

      await Promise.all(
        packageJson.triggers.map((trigger) => {
          if (trigger.type === "schedule") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              version: packageJson.version,
              context: {
                type: "schedule",
                cron: trigger.cron,
                timezone: trigger.timezone,
              },
            });
          }

          if (trigger.type === "http") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              version: packageJson.version,
              context: {
                type: "http",
                hostname: trigger.hostname,
                method: trigger.method,
                path: trigger.path,
              },
            });
          }

          if (trigger.type === "mqtt") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              version: packageJson.version,
              context: {
                type: "mqtt",
                topics: trigger.topics,
                connection: {
                  ...trigger.connection,
                  protocol: trigger.connection.protocol as any,
                },
              },
            });
          }
        })
      );

      if (actions.length === 1) {
        await cp(filename, getJobActionArchiveFile(actions[0]));
      }

      console.log(`[/publish/] ${benchmark()}ms - Finished`);

      return c.json({
        success: true,
        message: "ok",
      });
    });
  });

  return app;
}
