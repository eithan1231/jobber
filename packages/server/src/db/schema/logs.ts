import {
  pgTable,
  integer,
  uuid,
  text,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs.js";
import { actionsTable } from "./actions.js";

export const logsTable = pgTable(
  "logs",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    jobId: uuid().references(() => jobsTable.id, { onDelete: "cascade" }),

    actionId: uuid().references(() => actionsTable.id, {
      onDelete: "cascade",
    }),

    source: varchar({
      enum: ["system", "runner"],
    }).notNull(),

    created: integer().notNull(),
    message: text().notNull(),
  },
  (table) => [
    {
      jobIdCreatedIndex: index("jobId_created_idx").on(
        table.jobId,
        table.created
      ),
    },
  ]
);

export type LogsTableType = typeof logsTable.$inferSelect;
export type LogsTableInsertType = typeof logsTable.$inferInsert;
