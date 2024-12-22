import { and, eq } from "drizzle-orm";
import { createWriteStream } from "fs";
import { cp, readFile, rm } from "fs/promises";
import { Hono } from "hono";
import { ReadableStream } from "node:stream/web";
import { tmpdir } from "os";
import path from "path";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { getJobActionArchiveFile } from "~/paths.js";
import {
  createToken,
  getTmpFile,
  handleReadableStreamPipe,
  unzip,
} from "~/util.js";

const archiveFileSchema = z.object({
  name: z.string(),
  main: z
    .string()
    .refine((input) => input.startsWith("./"), "Must start with ./"),
  description: z.string(),
  version: z.string(),
  action: z.object({
    runnerAsynchronous: z.boolean().optional(),
    runnerMinCount: z.number().optional(),
    runnerMaxCount: z.number().optional(),
    runnerTimeout: z.number().optional(),
    runnerMaxAge: z.number().optional(),
    runnerMaxAgeHard: z.number().optional(),
    runnerMode: z.enum(["standard", "run-once"]).optional(),
  }),
  triggers: z.array(
    z.union([
      z.object({
        type: z.literal("schedule"),
        cron: z.string(),
        timezone: z.string().optional(),
      }),
      z.object({
        type: z.literal("http"),
        hostname: z.array(z.string()).nullable().default(null),
        method: z.array(z.string()).nullable().default(null),
        path: z.array(z.string()).nullable().default(null),
      }),
      z.object({
        type: z.literal("mqtt"),
        topics: z.array(z.string()),
        connection: z.object({
          protocol: z.string().optional(),
          protocolVariable: z.string().optional(),

          port: z.string().optional(),
          portVariable: z.string().optional(),

          host: z.string().optional(),
          hostVariable: z.string().optional(),

          username: z.string().optional(),
          usernameVariable: z.string().optional(),

          password: z.string().optional(),
          passwordVariable: z.string().optional(),

          clientId: z.string().optional(),
          clientIdVariable: z.string().optional(),
        }),
      }),
    ])
  ),
  links: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
      })
    )
    .default([]),
});

type ArchiveFileSchemaType = z.infer<typeof archiveFileSchema>;

const readArchiveFile = async (
  archiveFile: string
): Promise<ArchiveFileSchemaType> => {
  const cleanupFiles: string[] = [];
  try {
    const directory = path.join(
      tmpdir(),
      createToken({ length: 12, prefix: "ArchiveValidation" })
    );

    cleanupFiles.push(directory);

    await unzip(archiveFile, directory);

    const packageFile = path.join(directory, "package.json");

    const packageContent = await archiveFileSchema.parseAsync(
      JSON.parse(await readFile(packageFile, "utf8")),
      {
        path: ["request", "body", "package.json"],
      }
    );

    return packageContent;
  } finally {
    for (const file of cleanupFiles) {
      await rm(file, { recursive: true });
    }
  }
};

export async function createRoutePostPublish() {
  const app = new Hono();

  app.post("/job/publish/", async (c, _next) => {
    const body = await c.req.parseBody();

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

    const packageJson = await readArchiveFile(filename);

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

      return c.json({
        success: true,
        message: "ok",
      });
    });
  });

  return app;
}
