import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

type ServiceClientMetadataClientSecretBasic = {
  type: "client_secret_basic";
  clientSecretHashed: string;
};

type ServiceClientMetadataPrivateKeyJwt = {
  type: "private_key_jwt";
  publicKey: string;
};

type ServiceClientMetadata =
  | ServiceClientMetadataClientSecretBasic
  | ServiceClientMetadataPrivateKeyJwt;

export const oauthServiceClientTable = pgTable("oauthServiceClient", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  isSystemManaged: boolean("is_system_managed").notNull().default(false),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  clientId: varchar("clientId", { length: 255 }).notNull(),

  metadata: jsonb("metadata").$type<ServiceClientMetadata>().notNull(),

  allowedAudiences: jsonb("allowedAudiences").$type<string[]>().notNull(),
  allowedScopes: jsonb("allowedScopes").$type<string[]>().notNull(),

  enabled: boolean("enabled").default(true).notNull(),

  expiresAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
});

export type OauthServiceClientTableType =
  typeof oauthServiceClientTable.$inferSelect;
export type OauthServiceClientTableInsertType =
  typeof oauthServiceClientTable.$inferInsert;
