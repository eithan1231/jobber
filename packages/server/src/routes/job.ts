import { createWriteStream } from "fs";
import { readFile, rm } from "fs/promises";
import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { tmpdir } from "os";
import path from "path";
import { ReadableStream } from "stream/web";
import { z } from "zod";
import { Job } from "~/jobber/job.js";
import { SendHandleRequestHttp } from "~/jobber/runners/server.js";
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

  app.use(async (c, next) => {
    const start = performance.now();

    await next();

    const duration = (performance.now() - start).toFixed(2);

    console.log(
      `HTTP ${duration}ms ${c.res.status} ${c.req.method.toUpperCase()} ${
        c.req.path
      }`
    );
  });

  app.get("/:jobName", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    return c.json({
      success: true,
      data: {
        description: jobItem.description,
        name: jobItem.name,
        version: jobItem.version,
      },
    });
  });

  app.delete("/:jobName", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    await job.deleteJob(jobItem.name);

    return c.json({
      success: true,
      message: `Deleted ${jobItem.name}`,
    });
  });

  app.get("/:jobName/logs", async (c, next) => {
    const querySchema = z.object({
      runnerId: z.string().optional(),
      actionId: z.string().optional(),
      jobName: z.string().optional(),
      jobVersion: z.string().optional(),
      source: z.enum(["STDOUT", "STDERR"]).optional(),
      timestamp: z.coerce.number().optional(),
      message: z.string().optional(),
    });

    const filter = await querySchema.parseAsync(c.req.query(), {
      path: ["request", "query"],
    });

    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const logs = await job.findLogs(jobItem.name, filter);

    return c.json({
      success: true,
      message: `Returned result`,
      data: logs,
    });
  });

  app.get("/:jobName/environment", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const vars: Record<
      string,
      {
        type: "secret" | "text";
        value?: string;
      }
    > = job.getEnvironmentVariables(jobItem.name);

    for (const key of Object.keys(vars)) {
      if (vars[key].type === "secret") {
        delete vars[key].value;
      }
    }

    return c.json({
      success: true,
      message: "Fetched environment",
      data: vars,
    });
  });

  app.post("/:jobName/environment/:name", async (c, next) => {
    const nameSchema = z.string().min(1).max(128);

    const schema = z.object({
      type: z.enum(["secret", "text"]),
      value: z.string().max(512),
    });

    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const name = await nameSchema.parseAsync(c.req.param("name"), {
      path: ["request", "param"],
    });

    const body = await schema.parseAsync(await c.req.parseBody(), {
      path: ["request", "body"],
    });

    await job.upsertEnvironmentVariable(jobItem.name, name, body);

    return c.json({
      success: true,
      message: "Upserted new variable",
    });
  });

  app.delete("/:jobName/environment/:name", async (c, next) => {
    const nameSchema = z.string().min(1).max(128);

    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const name = await nameSchema.parseAsync(c.req.param("name"), {
      path: ["request", "param"],
    });

    await job.deleteEnvironmentVariable(jobItem.name, name);

    return c.json({
      success: true,
      message: `Deleted ${jobItem.name}`,
    });
  });

  app.get("/:jobName/action", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const actions = job.getJobActionsByJobName(jobItem.name);

    return c.json({
      success: true,
      data: actions,
    });
  });

  app.get("/:jobName/action:latest", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const actions = job.getJobActionsByJobName(jobItem.name);

    const action = actions.find((index) => index.version === jobItem.version);

    if (!action) {
      return await next();
    }

    return c.json({
      success: true,
      data: action,
    });
  });

  app.get("/:jobName/trigger", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const triggers = job.getJobTriggersByJobName(jobItem.name);

    return c.json({
      success: true,
      data: triggers,
    });
  });

  app.get("/:jobName/trigger:latest", async (c, next) => {
    const jobItem = job.getJob(c.req.param("jobName"));

    if (!jobItem) {
      return await next();
    }

    const triggers = job.getJobTriggersByJobName(jobItem.name);

    const latestTriggers = triggers.filter(
      (index) => index.version === jobItem.version
    );

    return c.json({
      success: true,
      data: latestTriggers,
    });
  });

  app.all("/:jobName/run", async (c, next) => {
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

  app.get("/", async (c, next) => {
    return c.json(
      {
        success: true,
        data: job.getJobs().map((jobItem) => ({
          name: jobItem.name,
          description: jobItem.description,
          version: jobItem.version,
        })),
      },
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
      console.log(
        `[/publish/] creating new job, name ${archiveContent.name}, description ${archiveContent.description}`
      );

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
      console.log(
        `[/publish/] Failed due to pre-existing actions with the same version`
      );

      return c.json(
        {
          success: false,
          message: "version has already been published",
        },
        400
      );
    }

    if (
      job
        .getJobTriggersByJobName(archiveContent.name)
        .some((trigger) => trigger.version === archiveContent.version)
    ) {
      console.log(
        `[/publish/] Failed due to pre-existing triggers with the same version`
      );

      return c.json(
        {
          success: false,
          message: "version has already been published",
        },
        400
      );
    }

    console.log(`[/publish/] Creating action...`);

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

    console.log(`[/publish/] Creating action... done`);

    console.log(`[/publish/] Creating triggers...`);

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

      if (trigger.type === "mqtt") {
        await job.createJobTrigger({
          jobName: archiveContent.name,
          version: archiveContent.version,
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
    }

    console.log(`[/publish/] Creating triggers... done`);

    console.log(`[/publish/] Updating job version...`);

    await job.updateJob(archiveContent.name, {
      version: archiveContent.version,
    });

    console.log(`[/publish/] Updating job version... done`);

    console.log(`[/publish/] Successful!`);

    return c.json({
      success: true,
      message: "Ok",
    });
  });

  return app;
};
