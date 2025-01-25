import { Hono } from "hono";
import { register } from "prom-client";

export async function createRouteGetMetrics() {
  const app = new Hono();

  app.get("/metrics", async (c, next) => {
    c.header("Content-Type", register.contentType);
    return c.text(await register.metrics(), 200);
  });

  return app;
}
