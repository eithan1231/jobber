import {
  pgTable,
  integer,
  uuid,
  text,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const logsTable = pgTable(
  "logs",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    jobId: uuid().notNull(),

    actionId: uuid().notNull(),

    source: varchar({
      enum: ["system", "runner"],
    }).notNull(),

    created: integer().notNull(),
    message: text().notNull(),
  },
  (table) => [index("jobId_created_idx").on(table.jobId, table.created)]
);

export type LogsTableType = typeof logsTable.$inferSelect;
export type LogsTableInsertType = typeof logsTable.$inferInsert;
