import { and, eq, lte } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { apiTokensTable } from "./schema.js";

async function byValidToken(token: string) {
  return await getDrizzle()
    .select()
    .from(apiTokensTable)
    .where(
      and(
        eq(apiTokensTable.token, token),
        eq(apiTokensTable.status, "enabled"),
        lte(apiTokensTable.expires, new Date()),
      ),
    )
    .limit(1)
    .then((res) => res.at(0));
}

export const apiTokensModel = {
  byValidToken,
};
