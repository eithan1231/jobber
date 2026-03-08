import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { RunnersTableInsertType } from "./types.js";
import { runnersTable } from "./schema.js";

async function byId(id: string) {
  const runner = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(eq(runnersTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return runner;
}

async function byStatus(status: RunnersTableInsertType["status"]) {
  const runners = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(eq(runnersTable.status, status));

  return runners;
}

async function byStatuses(statuses: RunnersTableInsertType["status"][]) {
  const runners = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(inArray(runnersTable.status, statuses));

  return runners;
}

async function byJobId(jobId: string, specialFilter: boolean = false) {
  const conditions: any = [eq(runnersTable.jobId, jobId)];

  if (specialFilter) {
    conditions.push(
      or(
        inArray(runnersTable.status, ["closing", "ready", "starting"]),
        and(
          eq(runnersTable.status, "closed"),
          gt(runnersTable.closedAt, sql`now() - interval '5 minutes'`),
        ),
      ),
    );
  }

  const runners = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(and(...conditions));

  return runners;
}

async function byContainerName(containerName: string) {
  const runners = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(
      eq(
        sql`${runnersTable.properties} ->> 'runnerContainerName'`,
        containerName,
      ),
    );

  return runners;
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
  byStatus,
  byStatuses,
  byJobId,
  byContainerName,
  all,
  create,
  update,
};
