import { pgTable, uuid, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const lockTable = pgTable("lock", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  lockKey: varchar({ length: 256 }).unique().notNull(),

  expires: timestamp()
    .notNull()
    .default(sql`NOW() + INTERVAL '5 minutes'`),
  created: timestamp()
    .notNull()
    .default(sql`NOW()`),
  modified: timestamp()
    .notNull()
    .default(sql`NOW()`),
});

export type LockTableType = typeof lockTable.$inferSelect;
