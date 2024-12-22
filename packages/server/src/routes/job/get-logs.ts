import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { logsTable } from "~/db/schema/logs.js";

export async function createRouteGetLogs() {
  const app = new Hono();

  app.get("/job/:jobId/logs", async (c, next) => {
    const jobId = c.req.param("jobId");

    let page = Number(c.req.query("page"));
    if (isNaN(page)) {
      page = 1;
    }

    const count = 128;
    const offset = (page - 1) * count;

    const logs = await getDrizzle()
      .select({
        jobId: logsTable.jobId,
        actionId: logsTable.actionId,
        source: logsTable.source,
        created: logsTable.created,
        message: logsTable.message,
      })
      .from(logsTable)
      .where(eq(logsTable.jobId, jobId))
      .orderBy(desc(logsTable.created))
      .offset(offset)
      .limit(count);

    return c.json({
      success: true,
      data: logs,
    });
  });

  return app;
}
