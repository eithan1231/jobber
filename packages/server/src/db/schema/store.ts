import {
  integer,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs.js";

export const storeTable = pgTable(
  "store",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    jobId: uuid()
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),

    storeKey: varchar({
      length: 128,
    }).notNull(),

    storeValue: text().notNull(),

    expiry: integer(),
    modified: integer().notNull(),
    created: integer().notNull(),
  },
  (table) => [unique().on(table.jobId, table.storeKey)]
);

export type StoreTableType = typeof storeTable.$inferSelect;
