import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { usersTable } from "./schema/users.js";

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

export const userModel = {
  byId,
  byUsername,
};
