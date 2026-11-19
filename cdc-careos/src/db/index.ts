/**
 * Database access.
 *
 * - `withOrg()` runs a callback inside a transaction whose Postgres settings
 *   (`app.current_org`, `app.guardian_id`) drive Row Level Security. ALL
 *   tenant data access must go through it.
 * - `authDb` is only for the authentication tables (user_accounts,
 *   auth_sessions, password_reset_tokens, rate_limit_events), which must be
 *   readable before the organization is known.
 */
import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __careosPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
}

export const pool = globalForDb.__careosPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__careosPool = pool;

export const db: DB = drizzle(pool, { schema });
/** Authentication tables only — see module docs. */
export const authDb = db;

export interface DbContext {
  orgId: string;
  guardianId?: string | null;
}

export async function withOrg<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_org', ${ctx.orgId}, true), set_config('app.guardian_id', ${ctx.guardianId ?? ""}, true)`,
    );
    return fn(tx);
  });
}

export { schema };
