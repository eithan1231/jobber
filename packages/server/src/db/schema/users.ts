import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { JobberPermissions } from "~/permissions.js";

export const UserUsernameSchema = z.string().min(3).max(32);
export const UserPasswordSchema = z.string().min(7);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    username: varchar().notNull().unique(),
    password: text().notNull(),

    permissions: jsonb().notNull().$type<JobberPermissions>(),

    created: timestamp().defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("usernameUniqueIndex").on(sql`lower(${table.username})`),
  ]
);

export type UsersTableType = typeof usersTable.$inferSelect;
export type UsersTableInsertType = typeof usersTable.$inferInsert;
