import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { jobsTable } from "./schema.js";

async function byId(id: string) {
  const job = await getDrizzle()
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return job;
}

async function all() {
  const jobs = await getDrizzle().select().from(jobsTable);
  return jobs;
}

export const jobModel = {
  byId,
  all,
};
