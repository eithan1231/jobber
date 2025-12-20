import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { container } from "tsyringe";
import { getDrizzle } from "~/db/index.js";
import { jobVersionsTable } from "~/db/schema/job-versions.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { triggersTable } from "~/db/schema/triggers.js";
import { InternalHonoApp } from "~/index.js";
import { TriggerCron } from "~/jobber/triggers/cron.js";
import { TriggerHttp } from "~/jobber/triggers/http.js";
import { TriggerMqtt } from "~/jobber/triggers/mqtt.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction } from "~/permissions.js";

export async function createRouteJobTriggers() {
  const triggerCron = container.resolve(TriggerCron);
  const triggerHttp = container.resolve(TriggerHttp);
  const triggerMqtt = container.resolve(TriggerMqtt);

  const app = new Hono<InternalHonoApp>();

  app.get(
    "/job/:jobId/triggers:current",
    createMiddlewareAuth(),
    async (c, next) => {
      const bouncer = c.get("bouncer")!;
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

      const triggersWithStatus = triggers.map((trigger) => {
        if (trigger.context.type === "schedule") {
          const status = triggerCron.getTriggerStatus(jobId, trigger.id);

          return {
            ...trigger,
            status,
          };
        }

        if (trigger.context.type === "http") {
          const status = triggerHttp.getTriggerStatus(jobId, trigger.id);

          return {
            ...trigger,
            status,
          };
        }

        if (trigger.context.type === "mqtt") {
          const status = triggerMqtt.getTriggerStatus(jobId, trigger.id);

          return {
            ...trigger,
            status,
          };
        }

        return {
          ...trigger,
          status: {
            status: "unknown",
            message: "unknown",
          } as const,
        };
      });

      const triggersFiltered = triggersWithStatus.filter((trigger) => {
        return bouncer.canReadJobTriggers(trigger);
      });

      return c.json({
        success: true,
        data: triggersFiltered,
      });
    }
  );

  app.get("/job/:jobId/triggers", createMiddlewareAuth(), async (c, next) => {
    const bouncer = c.get("bouncer")!;
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

    const triggersWithStatus = triggers.map((trigger) => {
      if (trigger.context.type === "schedule") {
        const status = triggerCron.getTriggerStatus(jobId, trigger.id);

        return {
          ...trigger,
          status,
        };
      } else if (trigger.context.type === "http") {
        const status = triggerHttp.getTriggerStatus(jobId, trigger.id);

        return {
          ...trigger,
          status,
        };
      } else if (trigger.context.type === "mqtt") {
        const status = triggerMqtt.getTriggerStatus(jobId, trigger.id);

        return {
          ...trigger,
          status,
        };
      } else {
        return {
          ...trigger,
          status: {
            status: "unknown",
            message: "unknown",
          } as const,
        };
      }
    });

    const triggersFiltered = triggersWithStatus.filter((trigger) => {
      return bouncer.canReadJobTriggers(trigger);
    });

    return c.json({
      success: true,
      data: triggersFiltered,
    });
  });

  app.get(
    "/job/:jobId/triggers/:triggerId/status",
    createMiddlewareAuth(),
    async (c, next) => {
      const bouncer = c.get("bouncer")!;
      const jobId = c.req.param("jobId");
      const triggerId = c.req.param("triggerId");

      const trigger = await getDrizzle()
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
        .limit(1)
        .then((row) => row.at(0) ?? null);

      if (!trigger) {
        return next();
      }

      if (!bouncer.canReadJobTriggers(trigger)) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
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
    }
  );

  return app;
}
