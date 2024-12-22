import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import {
  EnvironmentsContextSchemaType,
  environmentsTable,
} from "~/db/schema/environments.js";
import { getUnixTimestamp } from "~/util.js";

export async function createRouteDeleteEnvironmentVariable() {
  const app = new Hono();

  app.delete("/job/:jobId/environment/:name", async (c, _next) => {
    // TODO: This is vulnerable to race conditions, but but sadly drizzle doesnt
    // support a safe way way to delete an jsonb property... to my knowledge.
    // You will need to write a raw SQL query, which is not on my bucket-list.

    const nameSchema = z.string().min(1).max(128);

    const jobId = c.req.param("jobId");

    const name = await nameSchema.parseAsync(c.req.param("name"), {
      path: ["request", "param"],
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

  return app;
}
