import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
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

  description: text(),

  permissions: jsonb().notNull().$type<JobberPermissions>(),

  status: varchar({
    enum: ["enabled", "disabled"],
    length: 16,
  })
    .notNull()
    .default("enabled"),

  expires: timestamp().notNull(),
  created: timestamp().defaultNow().notNull(),
});

export type ApiTokensTableType = typeof apiTokensTable.$inferSelect;
export type ApiTokensTableInsertType = typeof apiTokensTable.$inferInsert;
