import { and, eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { triggersTable } from "./schema/triggers.js";

async function byId(id: string) {
  const trigger = await getDrizzle()
    .select()
    .from(triggersTable)
    .where(eq(triggersTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return trigger;
}

async function all(
  constraints: Partial<{ jobId: string; jobVersionId: string }> = {},
) {
  const conditions = Object.entries(constraints).map(([key, value]) =>
    eq((triggersTable as any)[key], value),
  );

  const triggers = await getDrizzle()
    .select()
    .from(triggersTable)
    .where(and(...conditions));

  return triggers;
}

export const triggersModel = {
  byId,
  all,
};
