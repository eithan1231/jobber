import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import {
  EnvironmentsContextSchemaType,
  environmentsTable,
} from "~/db/schema/environments.js";
import { getUnixTimestamp } from "~/util.js";
import { jobNameSchema } from "./schemas-common.js";

export async function createRoutePostEnvironmentVariable() {
  const app = new Hono();

  app.post("/job/:jobId/environment/:name", async (c, _next) => {
    // TODO: This is vulnerable to race conditions, but but sadly drizzle doesnt
    // support a safe way way to delete an jsonb property... to my knowledge.
    // You will need to write a raw SQL query, which is not on my bucket-list.

    const schema = z.object({
      type: z.enum(["secret", "text"]),
      value: z.string().max(512),
    });

    const jobId = c.req.param("jobId");

    const name = await jobNameSchema.parseAsync(c.req.param("name"), {
      path: ["request", "param"],
    });

    const body = await schema.parseAsync(await c.req.parseBody(), {
      path: ["request", "body"],
    });

    const environment = (
      await getDrizzle()
        .select({
          context: environmentsTable.context,
        })
        .from(environmentsTable)
        .where(eq(environmentsTable.jobId, jobId))
    ).at(0);

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

  return app;
}
