import { Hono } from "hono";
import { LogDriverBase } from "~/jobber/log-drivers/abstract.js";

export async function createRouteGetLogs(logger: LogDriverBase) {
  const app = new Hono();

  app.get("/job/:jobId/logs", async (c, next) => {
    const jobId = c.req.param("jobId");

    const logs = await logger.query({
      jobId,
    });

    return c.json({
      success: true,
      data: logs.reverse(),
    });
  });

  return app;
}
