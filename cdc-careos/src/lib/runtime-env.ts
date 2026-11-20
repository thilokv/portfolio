/**
 * Deployment settings read from environment variables.
 *
 * Pure functions with no Node-only imports, so the request proxy can use them.
 *
 * The database can be configured in two ways:
 *
 *  1. Explicit (local development, a VPS, any host): DATABASE_URL is the
 *     restricted runtime role and DATABASE_OWNER_URL the schema owner that runs
 *     migrations. See .env.example.
 *  2. Hosted integration (Vercel + Neon Postgres from the Vercel Marketplace):
 *     the integration injects only the database OWNER's connection strings.
 *     CareOS never runs the app as the owner (the owner bypasses Row Level
 *     Security). Instead the build creates a restricted runtime role and the
 *     app signs in with that — see src/db/connection.ts and
 *     scripts/vercel-build.ts.
 */
type Env = Record<string, string | undefined>;

/** Direct (non-pooled) owner connection strings set by Postgres integrations. */
const INTEGRATION_DIRECT_URL_VARS = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"] as const;

function value(env: Env, key: string): string | undefined {
  const v = env[key]?.trim();
  return v ? v : undefined;
}

export function isHostedOnVercel(env: Env = process.env): boolean {
  return env.VERCEL === "1";
}

/**
 * The owner connection string injected by a hosted Postgres integration, when
 * CareOS should configure itself from it. Explicit configuration
 * (DATABASE_OWNER_URL) always wins.
 */
export function integrationOwnerUrl(env: Env = process.env): string | undefined {
  if (!isHostedOnVercel(env) || value(env, "DATABASE_OWNER_URL")) return undefined;
  for (const key of INTEGRATION_DIRECT_URL_VARS) {
    const v = value(env, key);
    if (v) return v;
  }
  // The same variables with a custom prefix chosen when the store was connected,
  // e.g. STORAGE_DATABASE_URL_UNPOOLED.
  const prefixed = Object.keys(env)
    .filter((k) => INTEGRATION_DIRECT_URL_VARS.some((suffix) => k.endsWith(`_${suffix}`)))
    .sort();
  for (const key of prefixed) {
    const v = value(env, key);
    if (v) return v;
  }
  return undefined;
}

/** False only before a database has been connected (a fresh hosted deployment). */
export function isDatabaseConfigured(env: Env = process.env): boolean {
  return Boolean(integrationOwnerUrl(env) ?? value(env, "DATABASE_URL"));
}

/**
 * Public demo mode: shows a "fictional data" banner on every page and the demo
 * sign-in accounts on the login page, and lets the build load the fictional
 * demo center into an EMPTY database. Never enable it for a real center.
 */
export function isDemoMode(env: Env = process.env): boolean {
  return ["true", "yes", "1"].includes((env.CAREOS_DEMO_MODE ?? "").trim().toLowerCase());
}

/** Public base URL, used in links sent by e-mail. */
export function appBaseUrl(env: Env = process.env): string {
  const explicit = value(env, "APP_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = value(env, "VERCEL_PROJECT_PRODUCTION_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
