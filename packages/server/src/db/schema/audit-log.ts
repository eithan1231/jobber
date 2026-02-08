import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

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
    };

export const auditLogTable = pgTable("auditLog", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),

  subject: jsonb("subject").$type<AuditSubject>().notNull(),
  entry: jsonb("entry").$type<AuditEntry>().notNull(),

  created: timestamp().defaultNow().notNull(),
});

export type AuditLogTableType = typeof auditLogTable.$inferSelect;
export type AuditLogTableInsertType = typeof auditLogTable.$inferInsert;
