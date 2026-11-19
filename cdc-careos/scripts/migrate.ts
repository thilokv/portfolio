/**
 * Applies database migrations as the schema owner, then (re)applies the
 * least-privilege grants for the runtime application role.
 *
 *   npm run db:migrate            (uses .env.local)
 *   npm run db:migrate:test       (uses .env.test)
 */
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const ownerUrl = process.env.DATABASE_OWNER_URL;
const appRole = process.env.DATABASE_APP_ROLE ?? "careos_app";
if (!ownerUrl) throw new Error("DATABASE_OWNER_URL is not set");
if (!/^[a-z_][a-z0-9_]*$/.test(appRole)) throw new Error("DATABASE_APP_ROLE has an invalid name");

async function main() {
  const client = new Client({
    connectionString: ownerUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    // Runtime role: data access only. No DDL, no ownership, no BYPASSRLS.
    await client.query(`
      GRANT USAGE ON SCHEMA public TO ${appRole};
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${appRole};
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ${appRole};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole};
      -- audit log is append-only
      REVOKE UPDATE ON audit_logs FROM ${appRole};
      -- the only tables where rows may be removed by the application
      GRANT DELETE ON auth_sessions, rate_limit_events, session_goals, goal_observations, assessment_domains, staff_roles,
                      staff_availability, password_reset_tokens TO ${appRole};
      -- the drizzle bookkeeping schema is not needed at runtime
      REVOKE ALL ON SCHEMA drizzle FROM ${appRole};
    `);
    console.log(`Migrations applied; grants refreshed for role "${appRole}".`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
