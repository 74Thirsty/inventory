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
  const initial = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
  const cashContributions = await readFile(new URL("../migrations/002_cash_contributions.sql", import.meta.url), "utf8");
  await sql.unsafe(initial);
  await sql.unsafe(cashContributions);
}

export async function closeDb() {
  await sql.end({ timeout: 5 });
}
