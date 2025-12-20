import { Hono } from "hono";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import {
  EnvironmentsContextSchemaType,
  environmentsTable,
} from "~/db/schema/environments.js";
import { getUnixTimestamp } from "~/util.js";
import { jobEnvironmentNameSchema } from "./schemas-common.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { withLock } from "~/lock.js";
import { environmentModel } from "~/db/environment.js";
import { jobModel } from "~/db/job.js";

type EnvironmentGetResponseData = {
  [key: string]: { type: "text"; value: string } | { type: "secret" };
};

export async function createRouteJobEnvironment() {
  const app = new Hono<InternalHonoApp>();

  app.get(
    "/job/:jobId/environment",
    createMiddlewareAuth(),
    async (c, _next) => {
      const jobId = c.req.param("jobId");
      const bouncer = c.get("bouncer")!;

      const environment = await environmentModel.byJobId(jobId);

      if (!environment) {
        return c.json({
          success: true,
          data: {},
        });
      }

      const env: EnvironmentGetResponseData = {};

      for (const [name, data] of Object.entries(environment.context)) {
        if (!bouncer.canReadJobEnvironment(environment, name)) {
          continue;
        }

        if (data.type === "secret") {
          env[name] = {
            type: "secret",
          };
        }

        if (data.type === "text") {
          env[name] = {
            type: "text",
            value: data.value,
          };
        }
      }

      return c.json({
        success: true,
        data: env,
      });
    }
  );

  app.post(
    "/job/:jobId/environment/:name",
    createMiddlewareAuth(),
    async (c, _next) => {
      const bouncer = c.get("bouncer")!;

      const schema = z.object({
        type: z.enum(["secret", "text"]),
        value: z.string().max(512),
      });

      const jobId = c.req.param("jobId");

      const name = await jobEnvironmentNameSchema.parseAsync(
        c.req.param("name"),
        { path: ["request", "param"] }
      );

      const body = await schema.parseAsync(await c.req.parseBody(), {
        path: ["request", "body"],
      });

      const job = await jobModel.byId(jobId);

      if (!job) {
        return c.json({ success: false, message: "Job not found" }, 404);
      }

      if (!bouncer.canWriteJobEnvironment({ jobId: job.id }, name)) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      return await withLock("environment", job.id, async () => {
        const environment = await environmentModel.byJobId(jobId);

        const modified = getUnixTimestamp();

        const context: EnvironmentsContextSchemaType = {
          ...environment?.context,
          [name]: {
            type: body.type,
            value: body.value,
          },
        };

        await getDrizzle()
          .insert(environmentsTable)
          .values({
            modified: modified,
            jobId: jobId,
            context: context,
          })
          .onConflictDoUpdate({
            target: environmentsTable.jobId,
            set: {
              context: context,
              modified: modified,
            },
          });

        return c.json({
          success: true,
          message: "ok",
        });
      });
    }
  );

  app.delete(
    "/job/:jobId/environment/:name",
    createMiddlewareAuth(),
    async (c, _next) => {
      const bouncer = c.get("bouncer")!;
      const jobId = c.req.param("jobId");

      const name = await jobEnvironmentNameSchema.parseAsync(
        c.req.param("name"),
        { path: ["request", "param"] }
      );

      const job = await jobModel.byId(jobId);

      if (!job) {
        return c.json({ success: false, message: "Job not found" }, 404);
      }

      if (!bouncer.canDeleteJobEnvironment({ jobId: job.id }, name)) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      return await withLock("environment", jobId, async () => {
        const environment = await environmentModel.byJobId(jobId);

        const modified = getUnixTimestamp();

        const context: EnvironmentsContextSchemaType = {
          ...environment?.context,
        };

        delete context[name];

        await getDrizzle()
          .insert(environmentsTable)
          .values({
            modified: modified,
            jobId: jobId,
            context: context,
          })
          .onConflictDoUpdate({
            target: environmentsTable.jobId,
            set: {
              context: context,
              modified: modified,
            },
          });

        return c.json({
          success: true,
          message: "ok",
        });
      });
    }
  );

  return app;
}
