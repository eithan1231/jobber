import { Hono } from "hono";
import { InternalHonoApp } from "~/index.js";
import { Store } from "~/jobber/store.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJobStore(store: Store) {
  const app = new Hono<InternalHonoApp>();

  app.get(
    "/job/:jobId/store/:storeId",
    createMiddlewareAuth(),
    async (c, next) => {
      const auth = c.get("auth")!;
      const jobId = c.req.param("jobId");
      const storeId = c.req.param("storeId");

      const item = await store.getItemById(jobId, storeId);

      if (!item) {
        return next();
      }

      if (
        !canPerformAction(
          auth.permissions,
          `job/${item.jobId}/store/${item.id}`,
          "read"
        )
      ) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      return c.json({
        success: true,
        data: item,
      });
    }
  );

  app.get("/job/:jobId/store/", createMiddlewareAuth(), async (c, next) => {
    const auth = c.get("auth")!;
    const jobId = c.req.param("jobId");

    const items = await store.getItemsNoValue(jobId);

    const itemsFiltered = items.filter((item) => {
      return canPerformAction(
        auth.permissions,
        `job/${item.jobId}/store/${item.id}`,
        "read"
      );
    });

    return c.json({
      success: true,
      data: itemsFiltered,
    });
  });

  app.delete(
    "/job/:jobId/store/:storeId",
    createMiddlewareAuth(),
    async (c, next) => {
      const auth = c.get("auth")!;
      const jobId = c.req.param("jobId");
      const storeId = c.req.param("storeId");

      const item = await store.getItemById(jobId, storeId);

      if (!item) {
        return next();
      }

      if (
        !canPerformAction(
          auth.permissions,
          `job/${item.jobId}/store/${item.id}`,
          "delete"
        )
      ) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      await store.deleteItemById(jobId, storeId);

      return c.json({
        success: true,
        data: item,
      });
    }
  );

  return app;
}
