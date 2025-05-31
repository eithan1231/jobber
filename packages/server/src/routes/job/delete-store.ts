import { Hono } from "hono";
import { Store } from "~/jobber/store.js";

export async function createRouteDeleteStore(store: Store) {
  const app = new Hono();

  app.delete("/job/:jobId/store/:storeId", async (c, next) => {
    const jobId = c.req.param("jobId");
    const storeId = c.req.param("storeId");

    const item = await store.getItemById(jobId, storeId);
    await store.deleteItemById(jobId, storeId);

    return c.json({
      success: true,
      data: item,
    });
  });

  return app;
}
