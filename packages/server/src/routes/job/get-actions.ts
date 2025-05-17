import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { actionsTable } from "~/db/schema/actions.js";

export async function createRouteGetActions() {
  const app = new Hono();

  app.get("/job/:jobId/actions", async (c, next) => {
    const jobId = c.req.param("jobId");

    const actions = await getDrizzle()
      .select({
        id: actionsTable.id,
        jobId: actionsTable.jobId,
        version: actionsTable.version,
        runnerAsynchronous: actionsTable.runnerAsynchronous,
        runnerMinCount: actionsTable.runnerMinCount,
        runnerMaxCount: actionsTable.runnerMaxCount,
        runnerTimeout: actionsTable.runnerTimeout,
        runnerMaxAge: actionsTable.runnerMaxAge,
        runnerMaxAgeHard: actionsTable.runnerMaxAgeHard,
        runnerMode: actionsTable.runnerMode,
      })
      .from(actionsTable)
      .where(eq(actionsTable.jobId, jobId));

    return c.json({
      success: true,
      data: actions,
    });
  });

  return app;
}
