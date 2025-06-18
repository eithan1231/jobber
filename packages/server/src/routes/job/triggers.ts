import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { TriggerCron } from "~/jobber/triggers/cron.js";
import { TriggerHttp } from "~/jobber/triggers/http.js";
import { TriggerMqtt } from "~/jobber/triggers/mqtt.js";

export async function createRouteJobTriggers(
  triggerCron: TriggerCron,
  triggerHttp: TriggerHttp,
  triggerMqtt: TriggerMqtt
) {
  const app = new Hono();

  app.get("/job/:jobId/triggers:current", async (c, next) => {
    const jobId = c.req.param("jobId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        jobVersionId: triggersTable.jobVersionId,
        context: triggersTable.context,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(jobsTable)
      .innerJoin(
        triggersTable,
        and(
          eq(jobsTable.id, triggersTable.jobId),
          eq(jobsTable.jobVersionId, triggersTable.jobVersionId)
        )
      )
      .innerJoin(
        jobVersionsTable,
        and(
          eq(jobVersionsTable.jobId, triggersTable.jobId),
          eq(jobVersionsTable.id, triggersTable.jobVersionId)
        )
      )
      .where(eq(triggersTable.jobId, jobId));

    return c.json({
      success: true,
      data: triggers,
    });
  });

  app.get("/job/:jobId/triggers", async (c, next) => {
    const jobId = c.req.param("jobId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        jobVersionId: triggersTable.jobVersionId,
        context: triggersTable.context,

        // DEPRECATED: Use jobVersionId instead
        version: jobVersionsTable.version,
      })
      .from(triggersTable)
      .innerJoin(
        jobVersionsTable,
        and(
          eq(triggersTable.jobId, jobVersionsTable.jobId),
          eq(triggersTable.jobVersionId, jobVersionsTable.id)
        )
      )
      .where(eq(triggersTable.jobId, jobId));

    return c.json({
      success: true,
      data: triggers,
    });
  });

  app.get("/job/:jobId/triggers/:triggerId/status", async (c, next) => {
    const jobId = c.req.param("jobId");
    const triggerId = c.req.param("triggerId");

    const triggers = await getDrizzle()
      .select({
        id: triggersTable.id,
        jobId: triggersTable.jobId,
        jobVersionId: triggersTable.jobVersionId,
        context: triggersTable.context,
      })
      .from(triggersTable)
      .where(
        and(eq(triggersTable.id, triggerId), eq(triggersTable.jobId, jobId))
      )
      .limit(1);

    const trigger = triggers.at(0);

    if (!trigger) {
      return next();
    }

    if (trigger.context.type === "schedule") {
      const status = await triggerCron.getTriggerStatus(jobId, triggerId);

      return c.json({
        success: true,
        data: status,
      });
    } else if (trigger.context.type === "http") {
      const status = await triggerHttp.getTriggerStatus(jobId, triggerId);

      return c.json({
        success: true,
        data: status,
      });
    } else if (trigger.context.type === "mqtt") {
      const status = await triggerMqtt.getTriggerStatus(jobId, triggerId);

      return c.json({
        success: true,
        data: status,
      });
    }

    throw new Error("Unsupported trigger type: " + trigger.context["type"]);
  });

  return app;
}
