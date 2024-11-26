import { serve } from "@hono/node-server";
import { createWriteStream } from "fs";
import { Context, Hono, Next } from "hono";
import { ReadableStream } from "stream/web";
import { z, ZodError } from "zod";
import { getConfigOption } from "~/config.js";
import { REGEX_ALPHA_NUMERIC_DASHES } from "~/constants.js";
import { Job } from "~/jobber/job.js";
import { getTmpFile, handleReadableStreamPipe } from "./util.js";
import { SendHandleRequest } from "./jobber/job-controller.js";
import { StatusCode } from "hono/utils/http-status";

type VariableAuth = { authenticated: true } | { authenticated: false };

type Variables = {
  auth: VariableAuth;
};

const authGuard = (mode: "reject" | "permit" = "reject") => {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    let auth: VariableAuth = {
      authenticated: false,
    };

    const envBearerToken = getConfigOption("API_AUTH_BEARER_TOKEN");
    const authorisation = c.req.header("Authorization");

    if (envBearerToken && authorisation && envBearerToken === authorisation) {
      auth = {
        authenticated: true,
      };
    }

    c.set("auth", auth);

    if (auth.authenticated) {
      return next();
    }

    if (mode === "permit") {
      return next();
    }

    return c.json(
      {
        success: false,
        message: "Forbidden",
      },
      403
    );
  };
};

export const createHonoApp = async (job: Job) => {
  const app = new Hono<{ Variables: Variables }>();

  // Initialising variables
  app.use((c, next) => {
    c.set("auth", {
      authenticated: false,
    });

    return next();
  });

  app.onError(async (err, c) => {
    if (err instanceof ZodError) {
      if (
        err.errors.every(
          (issue) =>
            issue.path.at(0) === "request" && issue.path.at(1) === "body"
        )
      ) {
        return c.json({
          success: false,
          message: "Malformed request body",
          errors: err.errors.map(
            (issue) => `${issue.path.join(".")} - ${issue.message}`
          ),
        });
      }
    }

    console.error(err);

    return c.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      500
    );
  });

  app.notFound(async (c) => {
    return c.json(
      {
        success: false,
        message: "Page not found",
      },
      404
    );
  });

  app.get("/jobber/api/jobs", authGuard(), async (c, next) => {
    return c.json({
      success: true,
      data: await job.httpGetJobs(),
    });
  });

  app.post("/jobber/api/job", authGuard(), async (c, next) => {
    const mode = c.req.query("mode") === "zip" ? "zip" : "script";

    if (mode === "script") {
      console.log("[/api/job] Running in script mode");

      const schema = z.object({
        version: z.string(),

        name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
        description: z.string().optional(),

        conditionType: z.enum(["schedule", "http"]),

        conditionTimezone: z.string().optional(),
        conditionCron: z.string().optional(),
        conditionTimeout: z.coerce.number().optional(),

        conditionPath: z.string().optional(),
        conditionMethod: z.string().optional(),

        actionKeepAlive: z
          .string()
          .transform((val) => val.toLowerCase() === "true")
          .pipe(z.boolean())
          .optional(),
        actionRefreshTimeout: z.coerce.number().optional(),
        actionScript: z.string(),
      });

      const body = await schema.parseAsync(await c.req.parseBody(), {
        path: ["request", "body"],
      });

      await job.httpUpsertJobScript({
        name: body.name,
        version: body.version,
        description: body.description,
        execution: {
          conditions: [
            {
              type: body.conditionType,

              // Cron
              timezone: body.conditionTimezone,
              cron: body.conditionCron,

              // Http
              path: body.conditionPath,
              method: body.conditionMethod,
            },
          ],
          action: {
            type: "script",
            keepAlive: body.actionKeepAlive,
            refreshTimeout: body.actionRefreshTimeout,
            script: body.actionScript,
          },
        },
      });

      return c.json({
        success: true,
        message: "Ok",
      });
    }

    if (mode === "zip") {
      console.log("[/api/job] Running in zip mode");

      const body = await c.req.parseBody();

      const archiveFile = body["archive"];

      if (!(archiveFile instanceof File)) {
        return c.json(
          {
            success: false,
            message: "Expected file",
          },
          400
        );
      }

      if (!archiveFile.type.toLowerCase().startsWith("application/zip")) {
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

      await handleReadableStreamPipe(
        archiveFile.stream() as ReadableStream,
        writeStream
      );

      const result = await job.httpUpsertJobZip(archiveFilename);

      if (!result.success) {
        return c.json(
          {
            success: false,
            message: result.message,
          },
          400
        );
      }
      return c.json(
        {
          success: true,
          message: "Successfully upserted zip file",
        },
        200
      );
    }
  });

  app.use(async (c, next) => {
    const bodyDirect = await c.req.arrayBuffer();

    const headers = c.req.header();
    const query = c.req.query();
    const queries = c.req.queries();
    const path = c.req.path;
    const method = c.req.method;
    const body = Buffer.from(bodyDirect);
    const bodyLength = body.length;

    const payload: SendHandleRequest = {
      type: "http",
      body: body.toString("base64"),
      bodyLength,
      method,
      path,
      queries,
      query,
      headers,
    };

    const response = await job.httpRouteHandler(payload);

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

export const createHonoServer = async (job: Job) => {
  const app = await createHonoApp(job);

  return serve({
    port: 3000,
    fetch: app.fetch,
  });
};
