import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
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

    sort: varchar({ length: 32 }).notNull().default(""),

    created: timestamp().defaultNow().notNull(),
    message: text().notNull(),
  },
  (table) => [index("jobId_created_idx").on(table.jobId, table.created)]
);

export type LogsTableType = typeof logsTable.$inferSelect;
export type LogsTableInsertType = typeof logsTable.$inferInsert;
