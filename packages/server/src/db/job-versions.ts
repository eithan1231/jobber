import { and, eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { jobVersionsTable } from "./schema.js";

async function byId(id: string) {
  const jobVersion = await getDrizzle()
    .select()
    .from(jobVersionsTable)
    .where(eq(jobVersionsTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return jobVersion;
}

async function all(constraints: { jobId?: string } = {}) {
  const conditions = Object.entries(constraints).map(([key, value]) =>
    eq((jobVersionsTable as any)[key], value),
  );

  const jobVersions = await getDrizzle()
    .select()
    .from(jobVersionsTable)
    .where(and(...conditions));

  return jobVersions;
}

export const jobVersionsModel = {
  byId,
  all,
};
