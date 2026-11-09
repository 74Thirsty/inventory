const required = ["DATABASE_URL", "API_TOKEN", "APPROVER_TOKEN"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
  if (["API_TOKEN", "APPROVER_TOKEN"].includes(name) && process.env[name].length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
}
if (process.env.API_TOKEN === process.env.APPROVER_TOKEN) {
  throw new Error("API_TOKEN and APPROVER_TOKEN must be different");
}
export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  apiToken: process.env.API_TOKEN,
  approverToken: process.env.APPROVER_TOKEN,
  trustProxy: process.env.TRUST_PROXY === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  organizationName: process.env.ORGANIZATION_NAME || "Lost Limb Riders"
});
