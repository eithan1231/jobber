import { and, eq, gt, inArray, or, SQL, sql, SQLWrapper } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { RunnersTableInsertType } from "./types.js";
import { runnersTable } from "./schema.js";
import assert from "node:assert";

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

async function byJobId(
  jobId: string,
  filter: {
    /**
     * If true, only returns statuses that are ready or starting.
     */
    specialActiveIshOnly?: boolean;
  } = {},
) {
  const conditions: SQL[] = [eq(runnersTable.jobId, jobId)];

  if (filter.specialActiveIshOnly) {
    const condition = inArray(runnersTable.status, ["ready", "starting"]);

    assert(condition);

    conditions.push(condition);
  }

  const runners = await getDrizzle()
    .select()
    .from(runnersTable)
    .where(and(...conditions));

  return runners;
}

async function byJobIdSpecial(jobId: string, specialFilter: boolean = false) {
  const conditions: SQL[] = [eq(runnersTable.jobId, jobId)];

  if (specialFilter) {
    const condition = or(
      inArray(runnersTable.status, ["closing", "ready", "starting"]),
      and(
        eq(runnersTable.status, "closed"),
        gt(runnersTable.closedAt, sql`now() - interval '5 minutes'`),
      ),
    );

    assert(condition);

    conditions.push(condition);
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
  byJobIdSpecial,
  byContainerName,
  all,
  create,
  update,
};
