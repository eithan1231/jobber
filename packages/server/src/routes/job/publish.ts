import assert from "assert";
import { eq } from "drizzle-orm";
import { createWriteStream } from "fs";
import { cp } from "fs/promises";
import { Hono } from "hono";
import { ReadableStream } from "node:stream/web";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { classifyArchiveFile } from "~/jobber/images.js";
import { getJobActionArchiveFile } from "~/paths.js";
import {
  createBenchmark,
  getTmpFile,
  getUnixTimestamp,
  handleReadableStreamPipe,
} from "~/util.js";

export async function createRouteJobPublish() {
  const app = new Hono();

  const querySchema = z.object({
    allowAutomaticRollout: z
      .string()
      .transform((val) => val.toLowerCase() === "true")
      .pipe(z.boolean())
      .default("true"),
  });

  app.post("/job/publish/", async (c, _next) => {
    const benchmark = createBenchmark();

    console.log(`[/publish/] ${benchmark()}ms - Starting job publish`);

    const query = await querySchema.parseAsync(c.req.query());

    console.log(`[/publish/] ${benchmark()}ms - Parsed query parameters`);

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

    console.log(`[/publish/] ${benchmark()}ms - Queried job`);

    return await getDrizzle().transaction(async (tx) => {
      const timestamp = getUnixTimestamp();

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
            },
            target: jobsTable.jobName,
          })
          .returning()
      ).at(0);

      if (!job) {
        console.log(`[/publish/] Failed to create job for ${packageJson.name}`);

        return c.json({
          success: false,
          message: "Creation failed",
        });
      }

      const version = (
        await getDrizzle()
          .insert(jobVersionsTable)
          .values({
            jobId: job.id,
            version: packageJson.version,
            created: timestamp,
            modified: timestamp,
          })
          .onConflictDoNothing({
            target: [jobVersionsTable.jobId, jobVersionsTable.version],
          })
          .returning()
      ).at(0);

      if (!version) {
        console.log(
          `[/publish/] Failed to create job version for ${job.jobName} v${packageJson.version}`
        );

        return c.json({
          success: false,
          message: "Version already exists",
        });
      }

      if (version.created !== timestamp) {
        console.log(
          `[/publish/] Job version ${job.jobName} v${packageJson.version} already exists, skipping action creation`
        );

        return c.json({
          success: true,
          message: "Version already exists, skipping action creation",
        });
      }

      const action = (
        await tx
          .insert(actionsTable)
          .values({
            jobId: job.id,
            jobVersionId: version.id,
            runnerImage: classification.image.name,
            runnerAsynchronous: packageJson.action.runnerAsynchronous,
            runnerMaxAge: packageJson.action.runnerMaxAge,
            runnerMaxAgeHard: packageJson.action.runnerMaxAgeHard,
            runnerMaxCount: packageJson.action.runnerMaxCount,
            runnerMinCount: packageJson.action.runnerMinCount,
            runnerDockerArguments: packageJson.action.runnerDockerArguments,
            runnerMode: packageJson.action.runnerMode,
            runnerTimeout: packageJson.action.runnerTimeout,
            runnerMaxIdleAge: packageJson.action.runnerMaxIdleAge,
          })
          .returning()
      ).at(0);

      await Promise.all(
        packageJson.triggers.map((trigger) => {
          if (trigger.type === "schedule") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              jobVersionId: version.id,
              context: {
                type: "schedule",
                name: trigger.name,
                cron: trigger.cron,
                timezone: trigger.timezone,
              },
            });
          }

          if (trigger.type === "http") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              jobVersionId: version.id,
              context: {
                type: "http",
                name: trigger.name,
                hostname: trigger.hostname,
                method: trigger.method,
                path: trigger.path,
              },
            });
          }

          if (trigger.type === "mqtt") {
            return tx.insert(triggersTable).values({
              jobId: job.id,
              jobVersionId: version.id,
              context: {
                type: "mqtt",
                name: trigger.name,
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

      if (action) {
        await cp(filename, getJobActionArchiveFile(version, action));
      }

      if (query.allowAutomaticRollout) {
        console.log(
          "[/publish/] Automatic rollout enabled, updating job version"
        );

        await tx
          .update(jobsTable)
          .set({
            jobVersionId: version.id,
          })
          .where(eq(jobsTable.id, job.id));
      } else {
        console.log(
          "[/publish/] Automatic rollout disabled, not updating job version"
        );
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
