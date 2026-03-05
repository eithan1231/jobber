import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { actionsTable } from "./schema.js";

async function byId(id: string) {
  const action = await getDrizzle()
    .select()
    .from(actionsTable)
    .where(eq(actionsTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return action;
}

async function byVersionId(versionId: string) {
  const actions = await getDrizzle()
    .select()
    .from(actionsTable)
    .where(eq(actionsTable.jobVersionId, versionId))
    .then((res) => res.at(0));

  return actions;
}

async function all() {
  const actions = await getDrizzle().select().from(actionsTable);
  return actions;
}

export const actionsModel = {
  byId,
  byVersionId,
  all,
};
