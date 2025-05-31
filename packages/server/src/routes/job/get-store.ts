import { Hono } from "hono";
import { Store } from "~/jobber/store.js";

export async function createRouteGetStore(store: Store) {
  const app = new Hono();

  app.get("/job/:jobId/store/", async (c, next) => {
    const jobId = c.req.param("jobId");

    const items = await store.getItems(jobId);

    return c.json({
      success: true,
      data: items,
    });
  });

  return app;
}
