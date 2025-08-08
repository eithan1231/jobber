import { Hono } from "hono";
import { InternalHonoApp } from "~/index.js";
import { LogDriverBase } from "~/jobber/log-drivers/abstract.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJobLogs(logger: LogDriverBase) {
  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/logs", createMiddlewareAuth(), async (c, next) => {
    const jobId = c.req.param("jobId");
    const auth = c.get("auth")!;

    if (
      !canPerformAction(auth.permissions, `job/${jobId.toLowerCase()}`, "read")
    ) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403
      );
    }

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
