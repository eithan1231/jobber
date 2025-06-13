import {
  jsonb,
  PgColumn,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { jobVersionsTable } from "./job-versions.js";

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobName: varchar({ length: 128 }).unique().notNull(),
  description: text(),

  jobVersionId: uuid().references((): PgColumn => jobVersionsTable.id, {
    onDelete: "set null",
  }),

  status: varchar({
    enum: ["enabled", "disabled"],
    length: 16,
  }).default("enabled"),

  links: jsonb()
    .$type<
      Array<{
        name: string;
        url: string;
      }>
    >()
    .notNull()
    .default([]),
});

export type JobsTableType = typeof jobsTable.$inferSelect;
