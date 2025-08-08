import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import {
  EnvironmentsContextSchemaType,
  environmentsTable,
} from "~/db/schema/environments.js";
import { getUnixTimestamp } from "~/util.js";
import { jobEnvironmentNameSchema, jobNameSchema } from "./schemas-common.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";
import { withLock } from "~/lock.js";

export async function createRouteJobEnvironment() {
  const app = new Hono<InternalHonoApp>();

  app.get(
    "/job/:jobId/environment",
    createMiddlewareAuth(),
    async (c, _next) => {
      const jobId = c.req.param("jobId");
      const auth = c.get("auth")!;

      const environment = await getDrizzle()
        .select({
          context: environmentsTable.context,
          jobId: environmentsTable.jobId,
        })
        .from(environmentsTable)
        .where(eq(environmentsTable.jobId, jobId))
        .limit(1)
        .then((res) => res.at(0));

      if (!environment) {
        return c.json({
          success: true,
          data: {},
        });
      }

      const env: Record<
        string,
        { type: "text"; value: string } | { type: "secret" }
      > = {};

      for (const [name, data] of Object.entries(environment.context)) {
        if (
          !canPerformAction(
            auth.permissions,
            `job/${environment.jobId}/environment/${name}`,
            "read"
          )
        ) {
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
      // TODO: This is vulnerable to race conditions, but but sadly drizzle doesnt
      // support a safe way way to delete an jsonb property... to my knowledge.
      // You will need to write a raw SQL query, which is not on my bucket-list.

      const auth = c.get("auth")!;

      const schema = z.object({
        type: z.enum(["secret", "text"]),
        value: z.string().max(512),
      });

      const jobId = c.req.param("jobId");

      const name = await jobEnvironmentNameSchema.parseAsync(
        c.req.param("name"),
        {
          path: ["request", "param"],
        }
      );

      const body = await schema.parseAsync(await c.req.parseBody(), {
        path: ["request", "body"],
      });

      // TODO: Update to fetch from database, to compare jobId against the database record, not user input.
      if (
        !canPerformAction(
          auth.permissions,
          `job/${jobId.toLowerCase()}/environment/${name}`,
          "write"
        )
      ) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      return await withLock("environment", jobId, async () => {
        const environment = await getDrizzle()
          .select({
            context: environmentsTable.context,
          })
          .from(environmentsTable)
          .where(eq(environmentsTable.jobId, jobId))
          .limit(1)
          .then((res) => res.at(0));

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
      // TODO: This is vulnerable to race conditions, but but sadly drizzle doesnt
      // support a safe way way to delete an jsonb property... to my knowledge.
      // You will need to write a raw SQL query, which is not on my bucket-list.
      const auth = c.get("auth")!;

      const nameSchema = z.string().min(1).max(128);

      const jobId = c.req.param("jobId");

      const name = await nameSchema.parseAsync(c.req.param("name"), {
        path: ["request", "param"],
      });

      // TODO: Update to fetch from database, to compare jobId against the database record, not user input.
      if (
        !canPerformAction(
          auth.permissions,
          `job/${jobId.toLowerCase()}/environment/${name}`,
          "delete"
        )
      ) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      return await withLock("environment", jobId, async () => {
        const environment = await getDrizzle()
          .select({
            context: environmentsTable.context,
          })
          .from(environmentsTable)
          .where(eq(environmentsTable.jobId, jobId))
          .limit(1)
          .then((res) => res.at(0));

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
