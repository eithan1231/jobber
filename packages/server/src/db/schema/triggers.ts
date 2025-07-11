import { jsonb, pgTable, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { jobVersionsTable } from "./job-versions.js";
import { jobsTable } from "./jobs.js";

export const TriggersContextSchema = z.union([
  z.object({
    type: z.literal("schedule"),
    name: z.string().optional(),
    cron: z.string(),
    timezone: z.string().optional(),
  }),
  z.object({
    type: z.literal("http"),
    name: z.string().optional(),
    hostname: z.string().nullable().default(null),
    method: z.string().nullable().default(null),
    path: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal("mqtt"),
    name: z.string().optional(),
    topics: z.array(z.string()),
    connection: z.object({
      protocol: z.enum(["wss", "ws", "mqtt", "mqtts"]).optional(),
      protocolVariable: z.string().optional(),

      port: z.string().optional(),
      portVariable: z.string().optional(),

      host: z.string().optional(),
      hostVariable: z.string().optional(),

      username: z.string().optional(),
      usernameVariable: z.string().optional(),

      password: z.string().optional(),
      passwordVariable: z.string().optional(),

      clientId: z.string().optional(),
      clientIdVariable: z.string().optional(),
    }),
  }),
]);

export type TriggersContextSchemaType = z.infer<typeof TriggersContextSchema>;

export const triggersTable = pgTable("triggers", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  context: jsonb().$type<TriggersContextSchemaType>().notNull(),
});

export type TriggersTableType = typeof triggersTable.$inferSelect;
