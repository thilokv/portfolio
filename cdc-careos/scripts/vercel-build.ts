/**
 * Database preparation for hosted builds (Vercel runs this before `next build`,
 * see vercel.json and the "vercel-build" npm script).
 *
 *  - No database connected yet: print what to do and let the build finish.
 *    The deployed site then shows /setup with the same instructions.
 *  - Hosted Postgres integration (e.g. Neon from the Vercel Marketplace):
 *    create/refresh the restricted runtime role, apply migrations and grants,
 *    and verify the role cannot bypass Row Level Security.
 *  - Explicit configuration (DATABASE_OWNER_URL set): apply migrations and
 *    grants for the existing runtime role.
 *  - CAREOS_DEMO_MODE=true: load the FICTIONAL demo center, but only into a
 *    database that has no organizations at all. Real data is never touched.
 *
 * Usage (Vercel does this automatically):
 *   node --conditions=react-server --import tsx scripts/vercel-build.ts
 */
import { Client } from "pg";
import { appRoleName, deriveAppPassword, ownerConnection } from "../src/db/connection";
import { integrationOwnerUrl, isDatabaseConfigured, isDemoMode } from "../src/lib/runtime-env";
import { seedDemoData } from "./lib/demo-seed";
import { applyMigrationsAndGrants, assertRestrictedRole, ensureAppRole } from "./lib/migrations";

/** Arbitrary constant: serializes concurrent builds against the same database. */
const SETUP_LOCK_KEY = 4_127_731;

async function main() {
  const owner = ownerConnection();
  if (!isDatabaseConfigured() || !owner) {
    console.log(
      [
        "",
        "CareOS: no database is connected yet, so the site will open on its setup page.",
        "  1. In Vercel, open this project's Storage tab and create a Neon (Postgres) database.",
        "  2. Connect it to this project (keep the default settings).",
        "  3. Open the Deployments tab and redeploy the latest deployment.",
        "",
      ].join("\n"),
    );
    return;
  }

  const appRole = appRoleName();
  const integrationUrl = integrationOwnerUrl();
  const client = new Client(owner);
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK_KEY]);
    if (integrationUrl) {
      await ensureAppRole(client, appRole, deriveAppPassword(integrationUrl, appRole));
      console.log(`CareOS: runtime role "${appRole}" is ready.`);
    }
    await applyMigrationsAndGrants(client, appRole);
    await assertRestrictedRole(client, appRole);
    console.log(`CareOS: migrations applied; "${appRole}" has data access only and cannot bypass Row Level Security.`);

    if (isDemoMode()) {
      const { rows } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM organizations");
      if (rows[0].n === 0) {
        await seedDemoData(owner);
      } else {
        console.log("CareOS demo mode: the database already has data, so no demo data was added.");
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("CareOS database setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
