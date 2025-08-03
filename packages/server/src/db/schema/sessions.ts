import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { createToken } from "~/util.js";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  token: varchar({ length: 50 })
    .notNull()
    .unique()
    .$defaultFn(() => createToken({ length: 50 }).substring(0, 50)),

  userId: uuid()
    .notNull()
    .references(() => usersTable.id),

  status: varchar({ enum: ["active", "disabled"] })
    .notNull()
    .default("active"),

  expires: timestamp().notNull(),
  created: timestamp().defaultNow().notNull(),
});

export type SessionsTableType = typeof sessionsTable.$inferSelect;
export type SessionsTableInsertType = typeof sessionsTable.$inferInsert;
