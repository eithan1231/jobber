import { z } from "zod";
import {
  actionsTable,
  apiTokensTable,
  auditLogTable,
  environmentsTable,
  jobsTable,
  jobVersionsTable,
  lockTable,
  logsTable,
  oauthServiceClientTable,
  oauthSigningKeyTable,
  runnersTable,
  sessionsTable,
  storeTable,
  triggersTable,
  usersTable,
} from "./schema.js";

type ServiceClientMetadataClientSecretBasic = {
  type: "client_secret_basic";
  clientSecretHashed: string;
};

type ServiceClientMetadataPrivateKeyJwt = {
  type: "private_key_jwt";
  publicKey: string;
};

export type ServiceClientMetadata =
  | ServiceClientMetadataClientSecretBasic
  | ServiceClientMetadataPrivateKeyJwt;

export const EnvironmentsContextSchema = z.record(
  z.string(),
  z.object({
    value: z.string(),
    type: z.enum(["secret", "text"]),
  }),
);

export type EnvironmentsContextSchemaType = z.infer<
  typeof EnvironmentsContextSchema
>;

export type AuditSubject =
  | {
      type: "user";
      userId: string;
    }
  | {
      type: "service-client";
      serviceClientId: string;
    }
  | {
      type: "system";
    };

export type AuditEntry =
  | {
      type: "generic";
      message: string;
    }
  | {
      type: "oauth-invalid-client-id";
      clientId: string;
    }
  | {
      type: "oauth-invalid-client-secret";
      clientId: string;
    }
  | {
      type: "oauth-disabled-client";
      clientId: string;
    }
  | {
      type: "oauth-expired-client";
      clientId: string;
    }
  | {
      type: "oauth-unsupported-grant-type";
      clientId: string;
      grantType: string;
    }
  | {
      type: "oauth-rate-limited";
      clientId: string;
      reason: "global" | "client-id" | "ip";
    }
  | {
      type: "oauth-valid-client";
      clientId: string;
    }
  | {
      type: "oauth-invalid-audience";
      clientId: string;
      audience: string;
    };

export const ActionsDockerArgumentsSchema = z.object({
  networks: z.string().array().optional(),

  volumes: z
    .object({
      source: z.string(),
      target: z.string(),
      mode: z.enum(["rw", "ro"]).default("rw"),
    })
    .array()
    .optional(),

  labels: z
    .object({
      key: z.string().regex(/^[a-zA-Z0-9._-]+$/),
      value: z.string().regex(/^[a-zA-Z0-9._-]+$/),
    })
    .array()
    .optional(),

  memoryLimit: z
    .string()
    .regex(/^\d+[bkmg]$/)
    .optional(),

  directPassthroughArguments: z.string().array().optional(),
});

export type ActionsDockerArgumentsSchemaType = z.infer<
  typeof ActionsDockerArgumentsSchema
>;

export const UserUsernameSchema = z.string().min(3).max(32);
export const UserPasswordSchema = z.string().min(7);

export const TriggersContextSchema = z.union([
  z.object({
    type: z.literal("schedule"),
    name: z.string().optional(),
    cron: z.string(),
    timezone: z.string().optional(),
  }),
  z.object({
    type: z.literal("http"),
    name: z.string().optional(),
    hostname: z.string().nullable().default(null),
    method: z.string().nullable().default(null),
    path: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal("mqtt"),
    name: z.string().optional(),
    topics: z.array(z.string()),
    connection: z.object({
      protocol: z.enum(["wss", "ws", "mqtt", "mqtts"]).optional(),
      protocolVariable: z.string().optional(),

      port: z.string().optional(),
      portVariable: z.string().optional(),

      host: z.string().optional(),
      hostVariable: z.string().optional(),

      username: z.string().optional(),
      usernameVariable: z.string().optional(),

      password: z.string().optional(),
      passwordVariable: z.string().optional(),

      clientId: z.string().optional(),
      clientIdVariable: z.string().optional(),
    }),
  }),
]);
export type TriggersContextSchemaType = z.infer<typeof TriggersContextSchema>;

// Runners
export type RunnersTableType = typeof runnersTable.$inferSelect;
export type RunnersTableInsertType = typeof runnersTable.$inferInsert;

// OAuth Signing Keys
export type OauthSigningKeyTableType = typeof oauthSigningKeyTable.$inferSelect;
export type OauthSigningKeyTableInsertType =
  typeof oauthSigningKeyTable.$inferInsert;

// OAuth Service Client
export type OauthServiceClientTableType =
  typeof oauthServiceClientTable.$inferSelect;
export type OauthServiceClientTableInsertType =
  typeof oauthServiceClientTable.$inferInsert;

// Logs
export type LogsTableType = typeof logsTable.$inferSelect;
export type LogsTableInsertType = typeof logsTable.$inferInsert;

// Lock
export type LockTableType = typeof lockTable.$inferSelect;

// Jobs
export type JobsTableType = typeof jobsTable.$inferSelect;

// Versions
export type JobVersionsTableType = typeof jobVersionsTable.$inferSelect;

// Env
export type EnvironmentsTableType = typeof environmentsTable.$inferSelect;

// Audit Log
export type AuditLogTableType = typeof auditLogTable.$inferSelect;
export type AuditLogTableInsertType = typeof auditLogTable.$inferInsert;

// API Tokens
export type ApiTokensTableType = typeof apiTokensTable.$inferSelect;
export type ApiTokensTableInsertType = typeof apiTokensTable.$inferInsert;

// Actions
export type ActionsTableType = typeof actionsTable.$inferSelect;

// Users
export type UsersTableType = typeof usersTable.$inferSelect;
export type UsersTableInsertType = typeof usersTable.$inferInsert;

// Triggers
export type TriggersTableType = typeof triggersTable.$inferSelect;

// Store
export type StoreTableType = typeof storeTable.$inferSelect;
export type StoreTableInsertType = typeof storeTable.$inferInsert;

// Sessions
export type SessionsTableType = typeof sessionsTable.$inferSelect;
export type SessionsTableInsertType = typeof sessionsTable.$inferInsert;
