import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { runnersTable, RunnersTableInsertType } from "./schema/runners.js";

async function byId(id: string) {
  const runner = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(eq(runnersTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return runner;
}

async function all() {
  const runners = await getDrizzle().select().from(runnersTable);
  return runners;
}

async function create(input: RunnersTableInsertType) {
  const runner = await getDrizzle()
    .insert(runnersTable)
    .values(input)
    .returning()
    .then((res) => res.at(0));

  return runner;
}

async function update(id: string, input: Partial<RunnersTableInsertType>) {
  const runner = await getDrizzle()
    .update(runnersTable)
    .set(input)
    .where(eq(runnersTable.id, id))
    .returning()
    .then((res) => res.at(0));

  return runner;
}

export const runnersModel = {
  byId,
  all,
  create,
  update,
};
