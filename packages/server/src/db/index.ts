import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { getConfigOption } from "~/config.js";

const { Pool } = pg;

let db: ReturnType<typeof drizzle> | null = null;
let pool: pg.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getConfigOption("DATABASE_URL"),
      max: 20,
    });
  }

  return pool;
}

export function getDrizzle() {
  if (!db) {
    db = drizzle(getPool());
  }

  return db;
}

export async function runDrizzleMigration() {
  await migrate(getDrizzle(), {
    migrationsFolder: "./drizzle",
  });
}
