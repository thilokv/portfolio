/** DEV/TEST ONLY: drops all CareOS tables, then re-runs migrations. */
import { Client } from "pg";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL not set");
  if (!/localhost|127\.0\.0\.1/.test(url) && process.env.ALLOW_REMOTE_RESET !== "yes") {
    throw new Error("Refusing to reset a non-local database (set ALLOW_REMOTE_RESET=yes to override)");
  }
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await c.end();
  console.log("Schema dropped.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
