import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import { flagsTable } from "./schema.js";
import { FlagsTableType } from "./types.js";

async function getFlag(flag: FlagsTableType["flag"]) {
  const resultFound = await getDrizzle()
    .select()
    .from(flagsTable)
    .where(eq(flagsTable.flag, flag))
    .limit(1)
    .then((res) => res?.at(0));

  if (resultFound) {
    return resultFound.value;
  }

  const created = await getDrizzle()
    .insert(flagsTable)
    .values({
      flag,
    })
    .returning()
    .then((res) => res?.at(0));

  if (created) {
    return created.value;
  }

  throw new Error("failed to create flag");
}

async function setFlag(flag: FlagsTableType["flag"], value: boolean) {
  await getDrizzle()
    .insert(flagsTable)
    .values({
      flag: flag,
      value: value,
    })
    .onConflictDoUpdate({
      target: flagsTable.flag,
      set: {
        value: value,
      },
    });
}

export const flagModel = {
  getFlag,
  setFlag,
};
