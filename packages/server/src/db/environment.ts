import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { environmentsTable } from "./schema/environments.js";

async function byJobId(id: string) {
  const result = await getDrizzle()
    .select()
    .from(environmentsTable)
    .where(eq(environmentsTable.jobId, id))
    .limit(1)
    .then((res) => res.at(0));

  return result;
}

export const environmentModel = {
  byJobId,
};
