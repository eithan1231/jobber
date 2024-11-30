import { createWriteStream } from "fs";
import { readFile, rm } from "fs/promises";
import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { tmpdir } from "os";
import path from "path";
import { ReadableStream } from "stream/web";
import { z } from "zod";
import { Job } from "~/jobber/job.js";
import { SendHandleRequestHttp } from "~/jobber/runner-server.js";
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
      }),
    ])
  ),
});

type ArchiveFileSchemaType = z.infer<typeof archiveFileSchema>;

const readArchiveFile = async (
  archiveFile: string
): Promise<ArchiveFileSchemaType> => {
  const cleanupFiles: string[] = [];
  try {
    const directory = path.join(
      tmpdir(),
      createToken({ length: 12, prefix: "archive-validation" })
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

export const createRouteJob = async (job: Job) => {
  const app = new Hono();

  app.get("/:jobName", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    return c.json({
      description: jobItem.description,
      name: jobItem.name,
      version: jobItem.version,
    });
  });

  app.get("/", async (c, next) => {
    return c.json(
      job.getJobs().map((jobItem) => ({
        name: jobItem.name,
        description: jobItem.description,
        version: jobItem.version,
      })),
      200
    );
  });

  app.post("/", async (c, next) => {
    const schema = z.object({
      name: z.string(),
      description: z.string(),
    });

    const body = await schema.parseAsync(await c.req.parseBody(), {
      path: ["request", "body"],
    });

    await job.createJob(body);

    return c.json(
      {
        success: true,
        message: "ok",
      },
      200
    );
  });

  app.post("/publish/", async (c, next) => {
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

    const archiveFilename = getTmpFile({ extension: "zip" });

    const writeStream = createWriteStream(archiveFilename);

    console.log(`[/publish/] writing stream to disk, ${archiveFilename}`);

    await handleReadableStreamPipe(
      archiveFile.stream() as ReadableStream,
      writeStream
    );

    console.log(`[/publish/] finished writing stream to disk`);

    const archiveContent = await readArchiveFile(archiveFilename);

    const existingJob = job.getJob(archiveContent.name);

    if (!existingJob) {
      await job.createJob({
        name: archiveContent.name,
        description: archiveContent.description,
      });
    }

    if (
      job
        .getJobActionsByJobName(archiveContent.name)
        .some((action) => action.version === archiveContent.version)
    ) {
      return c.json({
        success: false,
        message: "version has already been published",
      });
    }

    if (
      job
        .getJobActionsByJobName(archiveContent.name)
        .some((trigger) => trigger.version === archiveContent.version)
    ) {
      return c.json({
        success: false,
        message: "version has already been published",
      });
    }

    await job.createJobAction(
      {
        jobName: archiveContent.name,
        runnerAsynchronous: archiveContent.action.runnerAsynchronous,
        runnerMaxAge: archiveContent.action.runnerMaxAge,
        runnerMaxAgeHard: archiveContent.action.runnerMaxAgeHard,
        runnerMaxCount: archiveContent.action.runnerMaxCount,
        runnerMinCount: archiveContent.action.runnerMinCount,
        runnerMode: archiveContent.action.runnerMode,
        version: archiveContent.version,
      },
      archiveFilename
    );

    for (const trigger of archiveContent.triggers) {
      if (trigger.type === "schedule") {
        await job.createJobTrigger({
          jobName: archiveContent.name,
          version: archiveContent.version,
          context: trigger,
        });
      }

      if (trigger.type === "http") {
        await job.createJobTrigger({
          jobName: archiveContent.name,
          version: archiveContent.version,
          context: trigger,
        });
      }
    }

    await job.updateJob(archiveContent.name, {
      version: archiveContent.version,
    });

    return c.json({
      success: true,
      message: "ok",
    });
  });

  app.all("/run/:jobName", async (c, next) => {
    const bodyDirect = await c.req.arrayBuffer();

    const headers = c.req.header();
    const query = c.req.query();
    const queries = c.req.queries();
    const path = c.req.path;
    const method = c.req.method;
    const body = Buffer.from(bodyDirect);
    const bodyLength = body.length;

    const payload: SendHandleRequestHttp = {
      type: "http",
      body: body.toString("base64"),
      bodyLength,
      method,
      path,
      queries,
      query,
      headers,
    };

    const response = await job.runJobHttpTrigger(
      c.req.param("jobName"),
      payload
    );

    if (!response) {
      return await next();
    }

    if (!response.success) {
      return c.json(
        {
          success: false,
          message: `Jobber: ${response.error}`,
        },
        502
      );
    }

    if (!response.http) {
      return c.json(
        {
          success: false,
          message: `Jobber: Job did not return a HTTP response`,
        },
        502
      );
    }

    return c.body(
      response.http.body,
      response.http.status as StatusCode,
      response.http.headers
    );
  });

  return app;
};
