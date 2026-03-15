import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { usersTable } from "./schema.js";
import { UsersTableInsertType } from "./types.js";

async function byId(id: string) {
  const user = await getDrizzle()
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return user;
}

async function byUsername(username: string) {
  const user = await getDrizzle()
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1)
    .then((res) => res.at(0));

  return user;
}

async function update(id: string, data: Partial<UsersTableInsertType>) {
  await getDrizzle().update(usersTable).set(data).where(eq(usersTable.id, id));
}

export const userModel = {
  byId,
  byUsername,
  update,
};
