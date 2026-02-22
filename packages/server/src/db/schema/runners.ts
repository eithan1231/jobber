import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobVersionsTable } from "./job-versions.js";
import { jobsTable } from "./jobs.js";
import { actionsTable } from "./actions.js";
import { environmentsTable } from "./environments.js";
import { oauthServiceClientTable } from "./oauth-service-client.js";

export const runnersTable = pgTable("runners", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  actionId: uuid()
    .notNull()
    .references(() => actionsTable.id, { onDelete: "cascade" }),
  environmentId: uuid().references(() => environmentsTable.id, {
    onDelete: "set null",
  }),

  oauthServiceClientId: uuid().references(() => oauthServiceClientTable.id, {
    onDelete: "set null",
  }),

  properties: jsonb()
    .$type<{
      runnerPid: string;
      runnerContainerId: string;
      runnerContainerName: string;
      runnerContainerNetworks: string[];
      runnerApiPort: number;
      runnerDebug: boolean;
    }>()
    .notNull(),

  lastRequestAt: timestamp().notNull().defaultNow(),

  createdAt: timestamp().notNull().defaultNow(),
  readyAt: timestamp(),
  closingAt: timestamp(),
  closedAt: timestamp(),
});

export type RunnersTableType = typeof runnersTable.$inferSelect;
