import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { actionsTable, jobsTable, jobVersionsTable } from "./schema.js";

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

async function byJobIdLatest(jobId: string) {
  const action = await getDrizzle()
    .select()
    .from(actionsTable)
    .innerJoin(jobsTable, eq(actionsTable.jobId, jobsTable.id))
    .innerJoin(
      jobVersionsTable,
      eq(jobsTable.jobVersionId, jobVersionsTable.id),
    )
    .where(eq(jobsTable.id, jobId))
    .limit(1)
    .then((res) => res.at(0)?.actions);

  return action;
}

async function all() {
  const actions = await getDrizzle().select().from(actionsTable);
  return actions;
}

export const actionsModel = {
  byId,
  byVersionId,
  byJobIdLatest,
  all,
};
