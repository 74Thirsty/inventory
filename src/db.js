import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { config } from "./config.js";

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: config.databaseSsl ? "require" : false,
  onnotice: () => {}
});

export async function migrate() {
  const migration = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
  await sql.unsafe(migration);
}

export async function closeDb() {
  await sql.end({ timeout: 5 });
}
