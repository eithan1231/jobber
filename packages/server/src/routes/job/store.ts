import { Hono } from "hono";
import { Store } from "~/jobber/store.js";

export async function createRouteJobStore(store: Store) {
  const app = new Hono();

  app.get("/job/:jobId/store/:storeId", async (c, next) => {
    const jobId = c.req.param("jobId");
    const storeId = c.req.param("storeId");

    const item = await store.getItemById(jobId, storeId);

    if (!item) {
      return next();
    }

    return c.json({
      success: true,
      data: item,
    });
  });

  app.get("/job/:jobId/store/", async (c, next) => {
    const jobId = c.req.param("jobId");

    const items = await store.getItemsNoValue(jobId);

    return c.json({
      success: true,
      data: items,
    });
  });

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
