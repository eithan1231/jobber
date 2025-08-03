import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { JobberPermissions } from "~/permissions.js";
import { usersTable } from "./users.js";
import { createToken } from "~/util.js";

export const apiTokensTable = pgTable("apiTokens", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  token: varchar({ length: 70 })
    .notNull()
    .unique()
    .$defaultFn(() => createToken({ length: 70 }).substring(0, 70)),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id),

  permissions: jsonb().notNull().$type<JobberPermissions>(),

  expires: timestamp().notNull(),
  created: timestamp().defaultNow().notNull(),
});

export type ApiTokensTableType = typeof apiTokensTable.$inferSelect;
export type ApiTokensTableInsertType = typeof apiTokensTable.$inferInsert;
