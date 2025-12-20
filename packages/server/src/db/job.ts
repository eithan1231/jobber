import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { jobsTable } from "./schema/jobs.js";

async function byId(id: string) {
  const job = await getDrizzle()
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return job;
}

export const jobModel = {
  byId,
};
