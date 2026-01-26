import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const jwtKeysTable = pgTable("jwtKey", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  privateKey: text().notNull(),
  publicKey: text().notNull(),

  status: varchar({
    length: 16,
    enum: ["enabled", "disabled"],
  })
    .notNull()
    .default("enabled"),

  expires: timestamp().notNull(),
  created: timestamp().defaultNow().notNull(),
});

export type JwtKeysTableType = typeof jwtKeysTable.$inferSelect;
export type JwtKeysTableInsertType = typeof jwtKeysTable.$inferInsert;
