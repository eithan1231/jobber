import { Hono } from "hono";
import { getConfigOption } from "~/config.js";

export async function createRouteConfig() {
  const app = new Hono();

  app.get("/config", async (c, next) => {
    return c.json({
      success: true,
      data: {
        jobberName: getConfigOption("JOBBER_NAME"),
        features: {
          metricsEnabled: getConfigOption("METRICS_PROMETHEUS_QUERY") !== null,
        },
      },
    });
  });

  return app;
}
