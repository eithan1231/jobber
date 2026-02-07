import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { auditLogTable } from "./schema/audit-log.js";
import { AuditEntry } from "./schema/audit-log.js";

async function byId(id: string) {
  const auditLog = await getDrizzle()
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return auditLog;
}

async function createUserLog(userId: string, entry: AuditEntry) {
  const auditLog = await getDrizzle()
    .insert(auditLogTable)
    .values({
      subject: {
        type: "user",
        userId,
      },
      entry,
    })
    .returning()
    .then((res) => res.at(0));

  return auditLog;
}

async function createServiceClientLog(
  serviceClientId: string,
  entry: AuditEntry,
) {
  const auditLog = await getDrizzle()
    .insert(auditLogTable)
    .values({
      subject: {
        type: "service-client",
        serviceClientId,
      },
      entry,
    })
    .returning()
    .then((res) => res.at(0));

  return auditLog;
}

async function createSystemLog(entry: AuditEntry) {
  const auditLog = await getDrizzle()
    .insert(auditLogTable)
    .values({
      subject: {
        type: "system",
      },
      entry,
    })
    .returning()
    .then((res) => res.at(0));

  return auditLog;
}

export const auditLogsModel = {
  byId,
  createUserLog,
  createServiceClientLog,
  createSystemLog,
};
