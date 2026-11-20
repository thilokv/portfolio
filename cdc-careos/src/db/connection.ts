/**
 * Connection settings for the runtime role and the schema owner.
 *
 * In hosted-integration mode (see src/lib/runtime-env.ts) only the owner's
 * connection string is available. The app must never run as the owner,
 * because the owner bypasses Row Level Security. So:
 *
 *  - the build creates a restricted role (DATABASE_APP_ROLE, default
 *    "careos_app": LOGIN, NOSUPERUSER, NOBYPASSRLS, owns nothing);
 *  - its password is DERIVED from the owner password with HMAC-SHA256, so no
 *    extra secret has to be stored anywhere. Anyone able to derive it already
 *    holds the owner password, which is strictly more powerful.
 *
 * Hosted connections always use TLS with certificate verification.
 */
import { createHmac } from "node:crypto";
import type { PoolConfig } from "pg";
import { integrationOwnerUrl } from "@/lib/runtime-env";

type Env = Record<string, string | undefined>;

export const DEFAULT_APP_ROLE = "careos_app";

export interface ConnectionSettings {
  connectionString: string;
  ssl?: PoolConfig["ssl"];
}

const VERIFIED_TLS = { rejectUnauthorized: true } as const;

export function appRoleName(env: Env = process.env): string {
  const role = env.DATABASE_APP_ROLE?.trim() || DEFAULT_APP_ROLE;
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("DATABASE_APP_ROLE has an invalid name");
  return role;
}

/** Password of the runtime role in hosted-integration mode (base64url, 256 bits). */
export function deriveAppPassword(ownerUrl: string, role: string): string {
  const ownerPassword = decodeURIComponent(new URL(ownerUrl).password);
  if (!ownerPassword) throw new Error("The database connection string has no password");
  return createHmac("sha256", ownerPassword).update(`careos-runtime-role:v1:${role}`).digest("base64url");
}

/**
 * The same server and database with a different login. A pooler tenant suffix
 * such as "postgres.<project-ref>" (Supabase) is kept: "careos_app.<project-ref>".
 */
export function withLogin(url: string, user: string, password: string): string {
  const u = new URL(url);
  const current = decodeURIComponent(u.username);
  const dot = current.indexOf(".");
  u.username = encodeURIComponent(dot >= 0 ? `${user}${current.slice(dot)}` : user);
  u.password = encodeURIComponent(password);
  return u.toString();
}

/** Drops libpq TLS parameters; verified TLS is configured explicitly instead. */
function withoutTlsParams(url: string): string {
  const u = new URL(url);
  for (const p of ["sslmode", "sslrootcert", "channel_binding", "uselibpqcompat"]) u.searchParams.delete(p);
  return u.toString();
}

/** How the running app connects (restricted role). Null when no database is configured. */
export function runtimeConnection(env: Env = process.env): ConnectionSettings | null {
  const owner = integrationOwnerUrl(env);
  if (owner) {
    const role = appRoleName(env);
    return { connectionString: withoutTlsParams(withLogin(owner, role, deriveAppPassword(owner, role))), ssl: VERIFIED_TLS };
  }
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  return { connectionString: url, ssl: env.DATABASE_SSL === "true" ? VERIFIED_TLS : undefined };
}

/** How migrations and setup connect (schema owner). Null when not configured. */
export function ownerConnection(env: Env = process.env): ConnectionSettings | null {
  const owner = integrationOwnerUrl(env);
  if (owner) return { connectionString: withoutTlsParams(owner), ssl: VERIFIED_TLS };
  const url = env.DATABASE_OWNER_URL?.trim();
  if (!url) return null;
  return { connectionString: url, ssl: env.DATABASE_SSL === "true" ? VERIFIED_TLS : undefined };
}
