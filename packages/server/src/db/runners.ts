import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { runnersTable } from "./schema/runners.js";

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

export const runnersModel = {
  byId,
  all,
};
