/**
 * Applies database migrations as the schema owner, then (re)applies the
 * least-privilege grants for the runtime application role.
 *
 *   npm run db:migrate            (uses .env.local)
 *   npm run db:migrate:test       (uses .env.test)
 */
import { Client } from "pg";
import { appRoleName, ownerConnection } from "../src/db/connection";
import { applyMigrationsAndGrants } from "./lib/migrations";

async function main() {
  const connection = ownerConnection();
  if (!connection) throw new Error("DATABASE_OWNER_URL is not set");
  const appRole = appRoleName();
  const client = new Client(connection);
  await client.connect();
  try {
    await applyMigrationsAndGrants(client, appRole);
    console.log(`Migrations applied; grants refreshed for role "${appRole}".`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
