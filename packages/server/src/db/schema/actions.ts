import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { getDefaultRuntimeImages } from "~/jobber/images.js";
import { jobVersionsTable } from "./job-versions.js";
import { jobsTable } from "./jobs.js";

export const actionsTable = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  runnerImage: text().notNull().default(getDefaultRuntimeImages().node),
  runnerAsynchronous: boolean().default(true).notNull(),
  runnerMinCount: integer().default(1).notNull(),
  runnerMaxCount: integer().default(16).notNull(),
  runnerTimeout: integer().default(60).notNull(),
  runnerMaxAge: integer().default(900).notNull(),
  runnerMaxAgeHard: integer().default(960).notNull(),
  runnerMode: text({
    enum: ["standard", "run-once"],
  }).default("standard"),
});

export type ActionsTableType = typeof actionsTable.$inferSelect;
