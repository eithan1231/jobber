import { Context, Hono, Next } from "hono";
import { serve } from "@hono/node-server";
import { Job } from "~/jobber/job.js";
import { getConfigOption } from "~/config.js";
import { z, ZodError } from "zod";
import { REGEX_ALPHA_NUMERIC_DASHES } from "~/constants.js";

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
        message: "Content not found",
      },
      404
    );
  });

  app.get("/api/jobs", authGuard(), async (c, next) => {
    return c.json({
      success: true,
      data: await job.getJobs(),
    });
  });

  // app.post("/api/job", authGuard(), async (c, next) => {
  //   const bod = await c.req.parseBody();
  //   console.log(bod);
  //   const schema = z.object({
  //     version: z.string(),

  //     name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
  //     description: z.string().optional(),

  //     "conditions.type[]": z
  //       .custom((data) => {
  //         if (Array.isArray(data)) {
  //           return data;
  //         } else {
  //           return [data];
  //         }
  //       })
  //       .pipe(z.array(z.enum(["schedule"]))),

  //     "conditions.timezone[]": z.array(z.string().optional()),
  //     "conditions.cron[]": z.array(z.string()),
  //     "conditions.timeout[]": z.array(z.coerce.number()),

  //     "action.type": z.enum(["script", "zip"]),
  //     "action.keepAlive": z.coerce.number().optional(),
  //     "action.refreshTimeout": z.coerce.number().optional(),
  //     "action.script": z.string().optional(), // type script
  //     "action.zip": z
  //       .custom((input) => {
  //         // if(input instanceof File)
  //         return true;
  //       })
  //       .optional(), // type zip
  //     "action.zip.entrypoint": z.string().optional(), // type zip
  //   });

  //   const body = await schema.parseAsync(bod, {
  //     path: ["request", "body"],
  //   });

  //   for (const condition of body["conditions.type[]"]) return c.json({});
  // });

  app.post("/api/job", authGuard(), async (c, next) => {
    const mode = c.req.query("mode") === "zip" ? "zip" : "script";

    if (mode === "script") {
      const schema = z.object({
        version: z.string(),

        name: z.string().max(32).min(3).regex(REGEX_ALPHA_NUMERIC_DASHES),
        description: z.string().optional(),

        conditionType: z.enum(["schedule"]),
        conditionTimezone: z.string().optional(),
        conditionCron: z.string(),
        conditionTimeout: z.coerce.number().optional(),

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

      await job.upsertJobScript({
        name: body.name,
        version: body.version,
        description: body.description,
        execution: {
          conditions: [
            {
              timezone: body.conditionTimezone,
              cron: body.conditionCron,
              type: body.conditionType,
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
    }
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
