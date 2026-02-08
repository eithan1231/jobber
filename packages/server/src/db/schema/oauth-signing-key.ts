import {
  boolean,
  jsonb,
  PgColumn,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const oauthSigningKeyTable = pgTable("oauthSigningKey", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  parentId: uuid("parent_id").references(
    (): PgColumn => oauthSigningKeyTable.id,
    {
      onDelete: "set null",
    },
  ),
  childId: uuid("child_id").references(
    (): PgColumn => oauthSigningKeyTable.id,
    {
      onDelete: "set null",
    },
  ),

  createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),

  status: varchar("status", {
    length: 255,
    enum: ["active", "retiring", "inactive"],
  }).notNull(),

  alg: varchar("alg", { length: 255, enum: ["RS256"] }).notNull(),
  use: varchar("use", { length: 255, enum: ["sig", "enc"] }).notNull(),

  privateKeyEncrypted: text("private_key_encrypted").notNull(),
  publicKey: text("public_key").notNull(),

  expiresAt: timestamp(),
  renewsAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
});

export type OauthSigningKeyTableType = typeof oauthSigningKeyTable.$inferSelect;
export type OauthSigningKeyTableInsertType =
  typeof oauthSigningKeyTable.$inferInsert;
