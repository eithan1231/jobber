import { Hono } from "hono";
import { container } from "tsyringe";
import { jobModel } from "~/db/job.js";
import { InternalHonoApp } from "~/index.js";
import { LogDriverBase } from "~/jobber/log-drivers/abstract.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";

export async function createRouteJobLogs() {
  const logger = container.resolve<LogDriverBase>("LogDriverBase");

  const app = new Hono<InternalHonoApp>();

  app.get("/job/:jobId/logs", createMiddlewareAuth(), async (c, next) => {
    const jobId = c.req.param("jobId");
    const bouncer = c.get("bouncer")!;

    const job = await jobModel.byId(jobId);

    if (!job) {
      return c.json({ success: false, message: "Job not found" }, 404);
    }

    if (!bouncer.canReadJob(job)) {
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
      data: logs.map((log) => ({
        ...log,

        // Frontend still uses unix timestamp, so lets convert it.
        created: Math.floor(log.created.getTime() / 1000),
      })),
    });
  });

  return app;
}
