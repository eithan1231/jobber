import { Hono } from "hono";
import { LogDriverBase } from "~/jobber/log-drivers/abstract.js";

export async function createRouteJobLogs(logger: LogDriverBase) {
  const app = new Hono();

  app.get("/job/:jobId/logs", async (c, next) => {
    const jobId = c.req.param("jobId");

    const logs = await logger.query({
      jobId,
    });

    return c.json({
      success: true,
      data: logs.reverse().map((log) => ({
        ...log,

        // Frontend still uses unix timestamp, so lets convert it.
        created: Math.floor(log.created.getTime() / 1000),
      })),
    });
  });

  return app;
}
