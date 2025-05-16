import { Hono } from "hono";
import { DecoupledStatus } from "~/jobber/decoupled-status.js";

export async function createRouteGetDecoupledStatus(
  decoupledStatus: DecoupledStatus
) {
  const app = new Hono();

  app.get("/decoupled-status/:key", async (c, next) => {
    const key = c.req.param("key");

    const item = await decoupledStatus.getItem(key);

    if (!item) {
      return await next();
    }

    return c.json({
      success: true,
      data: item,
    });
  });

  return app;
}
