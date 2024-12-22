import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { environmentsTable } from "~/db/schema/environments.js";

export async function createRouteGetEnvironment() {
  const app = new Hono();

  app.get("/job/:jobId/environment", async (c, _next) => {
    const jobId = c.req.param("jobId");

    const environment = (
      await getDrizzle()
        .select({
          context: environmentsTable.context,
        })
        .from(environmentsTable)
        .where(eq(environmentsTable.jobId, jobId))
    ).at(0);

    const env: Record<
      string,
      { type: "text"; value: string } | { type: "secret" }
    > = {};

    for (const [name, data] of Object.entries(environment?.context ?? {})) {
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
  });

  return app;
}
