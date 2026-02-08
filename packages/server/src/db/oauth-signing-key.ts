import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { getDrizzle } from "./index.js";
import {
  oauthSigningKeyTable,
  OauthSigningKeyTableInsertType,
  OauthSigningKeyTableType,
} from "./schema/oauth-signing-key.js";

async function byId(id: string) {
  const item = await getDrizzle()
    .select()
    .from(oauthSigningKeyTable)
    .where(eq(oauthSigningKeyTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return item;
}

async function create(item: OauthSigningKeyTableInsertType) {
  const createdItem = await getDrizzle()
    .insert(oauthSigningKeyTable)
    .values(item)
    .returning()
    .then((res) => res.at(0));

  return createdItem;
}

async function all() {
  const items = await getDrizzle().select().from(oauthSigningKeyTable);
  return items;
}

async function getValidKeys() {
  const items = await getDrizzle()
    .select()
    .from(oauthSigningKeyTable)
    .where(
      and(
        inArray(oauthSigningKeyTable.status, ["active", "retiring"]),
        or(
          gte(oauthSigningKeyTable.expiresAt, new Date()),
          isNull(oauthSigningKeyTable.expiresAt),
        ),
      ),
    );

  return items;
}

async function getValidKey() {
  const item = await getDrizzle()
    .select()
    .from(oauthSigningKeyTable)
    .where(
      and(
        inArray(oauthSigningKeyTable.status, ["active", "retiring"]),
        or(
          gte(oauthSigningKeyTable.expiresAt, new Date()),
          isNull(oauthSigningKeyTable.expiresAt),
        ),
      ),
    )
    .orderBy(desc(oauthSigningKeyTable.createdAt))
    .limit(1)
    .then((res) => res.at(0));

  return item;
}

async function update(
  id: string,
  data: Partial<OauthSigningKeyTableInsertType>,
) {
  await getDrizzle()
    .update(oauthSigningKeyTable)
    .set(data)
    .where(eq(oauthSigningKeyTable.id, id));
}

async function paginate(
  page: number,
  pageSize: number,
  filters?: Partial<Pick<OauthSigningKeyTableType, "status">>,
) {
  const whereClauses = [];

  if (filters?.status) {
    whereClauses.push(eq(oauthSigningKeyTable.status, filters.status));
  }

  const items = await getDrizzle()
    .select()
    .from(oauthSigningKeyTable)
    .where(and(...whereClauses))
    .orderBy(desc(oauthSigningKeyTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalItems = await getDrizzle()
    .select({ count: count(oauthSigningKeyTable.id) })
    .from(oauthSigningKeyTable)
    .where(and(...whereClauses))
    .then((res) => res.at(0)?.count ?? 0);

  return {
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
    currentPage: page,
  };
}

export const oauthSigningKeyModel = {
  all,
  byId,
  create,
  getValidKey,
  getValidKeys,
  paginate,
  update,
};
