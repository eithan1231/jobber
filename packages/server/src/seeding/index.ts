import { z } from "zod";
import { seedOauthClients } from "./oauth-clients.js";
import { SeedSchemaMap } from "./types.js";
import { getConfigOption } from "~/config.js";
import { seedUsers } from "./users.js";
import { seedApiTokens } from "./api-tokens.js";

const seeds = [seedOauthClients, seedUsers, seedApiTokens] as const;

type SeedNames = (typeof seeds)[number]["name"];

type SchemaMap = SeedSchemaMap<typeof seeds>;

export function getSeedNames(): SeedNames[] {
  return seeds.map((seed) => seed.name);
}

export function getSeedSchema() {
  const shape = {} as { [K in keyof SchemaMap]: SchemaMap[K] };

  for (const seed of seeds) {
    (shape as any)[seed.name] = seed.payload;
  }

  return z.object(shape);
}

export async function seedsRun() {
  const option = getConfigOption("SEED");

  let runCount = 0;

  for (const [key, value] of Object.entries(option)) {
    const seed = seeds.find((s) => s.name === key);

    if (!seed) {
      console.warn(`No seed found for key: ${key}`);
      continue;
    }

    try {
      runCount++;

      await seed.handler(value);
      console.log(`Seed "${key}" executed successfully.`);
    } catch (error) {
      console.error(`Error executing seed "${key}":`, error);
    }
  }

  if (!runCount) {
    console.log("No seeds to run.");
  }
}
