import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";

export async function createRoutePutJob() {
  const app = new Hono();

  app.put("/job/:jobId", async (c, _next) => {
    const jobId = c.req.param("jobId");

    const schema = z.object({
      status: z.enum(jobsTable.status.enumValues).optional(),
      description: z.string().optional(),
    });

    const body = await schema.parseAsync(await c.req.json(), {
      path: ["request", "body"],
    });

    await getDrizzle()
      .update(jobsTable)
      .set(body)
      .where(eq(jobsTable.id, jobId));

    return c.json({
      success: true,
      message: "ok",
    });
  });

  return app;
}
