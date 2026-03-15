import { Hono } from "hono";
import { auditLogsModel } from "~/db/audit-log.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";

export async function createRouteAuditLog() {
  const app = new Hono<InternalHonoApp>();

  app.get("/audit-log/", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canReadAuditLogGenerally()) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const cursor = c.req.query("cursor") ?? undefined;

    const result = await auditLogsModel.query(cursor);

    return c.json({
      success: true,
      data: result,
    });
  });

  return app;
}
