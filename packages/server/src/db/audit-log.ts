import { and, desc, eq, gt, gte, or } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { AuditEntry } from "./types.js";
import { auditLogTable } from "./schema.js";
import { createDatabaseCursor, parseDatabaseCursor } from "~/cursor.js";

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

async function query(cursor?: string) {
  const decodedCursor = parseDatabaseCursor(cursor);

  const size = decodedCursor?.size ?? 20;

  const auditLogs = await getDrizzle()
    .select()
    .from(auditLogTable)
    .where(
      decodedCursor
        ? or(
            gt(auditLogTable.created, decodedCursor.created),
            and(
              eq(auditLogTable.created, decodedCursor.created),
              gt(auditLogTable.id, decodedCursor.id),
            ),
          )
        : undefined,
    )
    .orderBy(desc(auditLogTable.created))
    .limit(size + 1)
    .then((res) => res);

  let nextCursor = null as string | null;
  let previousCursor = null as string | null;

  if (auditLogs.length > size) {
    const next = auditLogs[size];

    nextCursor = createDatabaseCursor({
      size,
      created: next.created,
      id: next.id,

      createdPrevious: auditLogs[0].created,
      idPrevious: auditLogs[0].id,
    });

    auditLogs.pop();
  }

  if (decodedCursor) {
    previousCursor = createDatabaseCursor({
      size,
      created: auditLogs[0].created,
      id: auditLogs[0].id,

      createdPrevious: decodedCursor.createdPrevious ?? null,
      idPrevious: decodedCursor.idPrevious ?? null,
    });
  }

  return {
    data: auditLogs,
    nextCursor: nextCursor,
    prevCursor: previousCursor,
  };
}

export const auditLogsModel = {
  query,
  byId,
  createUserLog,
  createServiceClientLog,
  createSystemLog,
};
