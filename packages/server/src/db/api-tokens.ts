import { and, eq, lte } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { apiTokensTable } from "./schema.js";
import { ApiTokensTableInsertType } from "./types.js";

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

async function byToken(token: string) {
  return await getDrizzle()
    .select()
    .from(apiTokensTable)
    .where(eq(apiTokensTable.token, token))
    .limit(1)
    .then((res) => res.at(0));
}

async function create(tokenData: ApiTokensTableInsertType) {
  return await getDrizzle()
    .insert(apiTokensTable)
    .values(tokenData)
    .returning()
    .then((res) => res.at(0));
}

async function update(
  tokenId: string,
  updates: Partial<ApiTokensTableInsertType>,
) {
  return await getDrizzle()
    .update(apiTokensTable)
    .set(updates)
    .where(eq(apiTokensTable.id, tokenId))
    .returning()
    .then((res) => res.at(0));
}

export const apiTokensModel = {
  byToken,
  byValidToken,
  create,
  update,
};
