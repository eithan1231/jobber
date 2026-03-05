import { and, eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { getUnixTimestamp } from "~/util.js";
import { storeTable } from "./schema.js";
import { StoreTableInsertType } from "./types.js";

async function byId(id: string) {
  const store = await getDrizzle()
    .select()
    .from(storeTable)
    .where(eq(storeTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return store;
}

async function byKey(jobId: string, storeKey: string) {
  const store = await getDrizzle()
    .select()
    .from(storeTable)
    .where(and(eq(storeTable.jobId, jobId), eq(storeTable.storeKey, storeKey)))
    .limit(1)
    .then((res) => res.at(0));

  return store;
}

async function upsert(
  data: Pick<
    StoreTableInsertType,
    "jobId" | "storeKey" | "storeValue" | "expiry"
  >,
) {
  const now = getUnixTimestamp();

  const insertData = {
    ...data,
    modified: now,
    created: now,
  } satisfies StoreTableInsertType;

  const store = await getDrizzle()
    .insert(storeTable)
    .values(insertData)
    .onConflictDoUpdate({
      target: [storeTable.jobId, storeTable.storeKey],
      set: {
        storeValue: insertData.storeValue,
        expiry: insertData.expiry,
        modified: insertData.modified,
      },
    })
    .returning()
    .then((res) => res.at(0));

  return store;
}

async function deleteById(id: string) {
  await getDrizzle().delete(storeTable).where(eq(storeTable.id, id));
}

async function deleteByKey(jobId: string, storeKey: string) {
  return await getDrizzle()
    .delete(storeTable)
    .where(and(eq(storeTable.jobId, jobId), eq(storeTable.storeKey, storeKey)))
    .returning()
    .then((items) => items.at(0) ?? null);
}

export const storeModel = {
  byId,
  byKey,
  upsert,
  deleteById,
  deleteByKey,
};
