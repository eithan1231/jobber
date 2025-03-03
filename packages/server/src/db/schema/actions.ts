import {
  boolean,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs.js";
import { getDefaultRuntimeImages } from "~/jobber/images.js";

export const actionsTable = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  version: varchar({ length: 16 }).notNull(),
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
