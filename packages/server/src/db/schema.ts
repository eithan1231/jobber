import { JobberPermissions } from "@jobber/common/permissions.js";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  PgColumn,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDefaultRuntimeImages } from "~/jobber/images.js";
import { createToken } from "~/util.js";
import {
  ActionsDockerArgumentsSchemaType,
  AuditEntry,
  AuditSubject,
  EnvironmentsContextSchemaType,
  ServiceClientMetadata,
  TriggersContextSchemaType,
} from "./types.js";

/**
 * Runners
 */
export const runnersTable = pgTable("runners", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  status: varchar("status", {
    length: 50,
    enum: ["starting", "ready", "closing", "closed"],
  }).notNull(),

  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  actionId: uuid()
    .notNull()
    .references(() => actionsTable.id, { onDelete: "cascade" }),
  environmentId: uuid().references(() => environmentsTable.id, {
    onDelete: "set null",
  }),

  oauthServiceClientId: uuid().references(() => oauthServiceClientTable.id, {
    onDelete: "set null",
  }),

  properties: jsonb().$type<{
    runnerPid: string;
    runnerContainerName: string;
    runnerContainerNetworks: string[];
    runnerApiPort: number;
    runnerDebug: boolean;
  }>(),

  createdAt: timestamp().notNull().defaultNow(),
  readyAt: timestamp(),
  closingAt: timestamp(),
  closedAt: timestamp(),
});

/**
 * OAuth Signing Keys
 */
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

/**
 * OAuth Service Clients
 */
export const oauthServiceClientTable = pgTable("oauthServiceClient", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  isSystemManaged: boolean("is_system_managed").notNull().default(false),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  clientId: varchar("clientId", { length: 255 }).unique().notNull(),

  metadata: jsonb("metadata").$type<ServiceClientMetadata>().notNull(),

  allowedAudiences: jsonb("allowedAudiences").$type<string[]>().notNull(),
  allowedScopes: jsonb("allowedScopes").$type<string[]>().notNull(),

  permissions: jsonb("permissions").$type<JobberPermissions>().notNull(),

  enabled: boolean("enabled").default(true).notNull(),

  expiresAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
});

/**
 * Logs
 */
export const logsTable = pgTable(
  "logs",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    jobId: uuid().notNull(),

    actionId: uuid().notNull(),

    source: varchar({
      enum: ["system", "runner"],
    }).notNull(),

    sort: varchar({ length: 32 }).notNull().default(""),

    created: timestamp().defaultNow().notNull(),
    message: text().notNull(),
  },
  (table) => [index("jobId_created_idx").on(table.jobId, table.created)],
);

/**
 * Locks
 */
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

/**
 * Jobs
 */
export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobName: varchar({ length: 128 }).unique().notNull(),
  description: text(),

  jobVersionId: uuid().references((): PgColumn => jobVersionsTable.id, {
    onDelete: "set null",
  }),

  status: varchar({
    enum: ["enabled", "disabled"],
    length: 16,
  }).default("enabled"),

  links: jsonb()
    .$type<
      Array<{
        name: string;
        url: string;
      }>
    >()
    .notNull()
    .default([]),
});

/**
 * Job Versions
 */
export const jobVersionsTable = pgTable(
  "job-versions",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    jobId: uuid()
      .notNull()
      .references((): PgColumn => jobsTable.id, { onDelete: "cascade" }),

    version: varchar({ length: 32 }).notNull(),

    modified: integer().notNull(),
    created: integer().notNull(),
  },
  (table) => [unique().on(table.jobId, table.version)],
);

/**
 * Environments
 */
export const environmentsTable = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .unique()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),

  context: jsonb().$type<EnvironmentsContextSchemaType>().notNull().default({}),

  modified: integer().notNull(),
});

/**
 * Audit Logs
 */
export const auditLogTable = pgTable("auditLog", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  subject: jsonb("subject").$type<AuditSubject>().notNull(),
  entry: jsonb("entry").$type<AuditEntry>().notNull(),

  created: timestamp().defaultNow().notNull(),
});

/**
 * API Tokens
 */
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

/**
 * Actions
 */
export const actionsTable = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  runnerImage: text().notNull().default(getDefaultRuntimeImages().node),
  runnerAsynchronous: boolean().default(true).notNull(),
  runnerMinCount: integer().default(1).notNull(),
  runnerMaxCount: integer().default(16).notNull(),
  runnerTimeout: integer().default(60).notNull(),
  runnerMaxIdleAge: integer().default(0).notNull(),
  runnerMaxAge: integer().default(900).notNull(),
  runnerMaxAgeHard: integer().default(960).notNull(),
  runnerDockerArguments: jsonb()
    .$type<ActionsDockerArgumentsSchemaType>()
    .notNull()
    .default({}),
  runnerMode: text({
    enum: ["standard", "run-once"],
  }).default("standard"),
});

/**
 * Users
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),

    username: varchar().notNull().unique(),
    password: text().notNull(),

    enabled: boolean().default(true).notNull(),

    permissions: jsonb().notNull().$type<JobberPermissions>(),

    created: timestamp().defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("usernameUniqueIndex").on(sql`lower(${table.username})`),
  ],
);

/**
 * Triggers
 */
export const triggersTable = pgTable("triggers", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  context: jsonb().$type<TriggersContextSchemaType>().notNull(),
});

/**
 * Store
 */
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
  (table) => [unique().on(table.jobId, table.storeKey)],
);

/**
 * Sessions
 */
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
