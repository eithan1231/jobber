import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { JobberPermissions } from "~/permissions.js";
import { usersTable } from "./users.js";

export const apiTokensTable = pgTable("apiTokens", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  token: varchar().notNull().unique(),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id),

  permissions: jsonb().notNull().$type<JobberPermissions>(),

  expires: timestamp().notNull(),
  created: timestamp().defaultNow().notNull(),
});

export type ApiTokensTableType = typeof apiTokensTable.$inferSelect;
export type ApiTokensTableInsertType = typeof apiTokensTable.$inferInsert;
