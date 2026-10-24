import { eq, lt, sql } from "drizzle-orm";
import { getDrizzle } from "./db/index.js";
import { lockTable } from "./db/schema/lock.js";
import { timeout } from "./util.js";

export const acquireLock = async (
  table: string,
  primaryKey: string
): Promise<string | null> => {
  const lockKey = `${table}:${primaryKey}`;

  // A held lock conflicts on lockKey and inserts nothing, rather than throwing a unique violation.
  const result = (
    await getDrizzle()
      .insert(lockTable)
      .values({
        lockKey,
      })
      .onConflictDoNothing({ target: lockTable.lockKey })
      .returning()
  ).at(0);

  if (!result) {
    return null;
  }

  return result.id;
};

export const releaseLock = async (lockId: string): Promise<void> => {
  await getDrizzle().delete(lockTable).where(eq(lockTable.id, lockId));
};

export const withLock = async <T>(
  table: string,
  primaryKey: string,
  callback: () => Promise<T>
): Promise<T> => {
  let lockId: string | null = null;

  for (let i = 0; i < 25; i++) {
    lockId = await acquireLock(table, primaryKey);

    if (lockId !== null) {
      break;
    }

    await timeout(5 * i);
  }

  if (!lockId) {
    throw new Error(`Failed to acquire lock for ${table}:${primaryKey}`);
  }

  let result: T;

  try {
    result = await callback();
  } finally {
    releaseLock(lockId);
  }

  return result;
};

export const cleanupLocks = async (): Promise<void> => {
  await getDrizzle()
    .delete(lockTable)
    .where(lt(lockTable.expires, sql`NOW()`));
};
