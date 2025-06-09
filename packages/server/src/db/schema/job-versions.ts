import {
  integer,
  PgColumn,
  pgTable,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs.js";

export const jobVersionsTable = pgTable(
  "job-versions",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    jobId: uuid()
      .notNull()
      .references((): PgColumn => jobsTable.id, { onDelete: "cascade" }),

    version: varchar({ length: 32 }).notNull(),

    modified: integer().notNull(),
    created: integer().notNull(),
  },
  (table) => [unique().on(table.jobId, table.version)]
);

export type JobVersionsTableType = typeof jobVersionsTable.$inferSelect;
