import { config } from "./config.js";
import { migrate, closeDb } from "./db.js";
import { buildApp } from "./app.js";

const app = buildApp();
try {
  await migrate();
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error({ err: error }, "startup failed");
  await closeDb();
  process.exit(1);
}

const shutdown = async (signal) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await closeDb();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
