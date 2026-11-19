/**
 * Server-side sessions: an opaque random token in an HttpOnly cookie; only
 * its SHA-256 hash is stored. Sessions expire after SESSION_MAX_AGE_HOURS and
 * after SESSION_IDLE_TIMEOUT_MINUTES of inactivity, and can be revoked.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { authDb } from "@/db";
import { authSessions, userAccounts } from "@/db/schema";
import { generateToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "careos_session";
const maxAgeHours = Number(process.env.SESSION_MAX_AGE_HOURS ?? 12);
const idleMinutes = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 60);
const TOUCH_INTERVAL_MS = 60_000;

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + maxAgeHours * 3600 * 1000);
  await authDb.insert(authSessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ipAddress: await getClientIp(),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  organizationId: string;
  accountType: "staff" | "guardian";
  email: string;
  preferredLocale: string;
  mustChangePassword: boolean;
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await authDb
    .select({
      sessionId: authSessions.id,
      expiresAt: authSessions.expiresAt,
      lastSeenAt: authSessions.lastSeenAt,
      userId: userAccounts.id,
      organizationId: userAccounts.organizationId,
      accountType: userAccounts.accountType,
      email: userAccounts.email,
      isActive: userAccounts.isActive,
      preferredLocale: userAccounts.preferredLocale,
      mustChangePassword: userAccounts.mustChangePassword,
    })
    .from(authSessions)
    .innerJoin(userAccounts, eq(userAccounts.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, sha256(token)), isNull(authSessions.revokedAt)))
    .limit(1);
  if (!row || !row.isActive) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) return null;
  if (row.lastSeenAt.getTime() + idleMinutes * 60_000 <= now) return null;
  if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await authDb.update(authSessions).set({ lastSeenAt: new Date(now) }).where(eq(authSessions.id, row.sessionId));
  }
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    organizationId: row.organizationId,
    accountType: row.accountType,
    email: row.email,
    preferredLocale: row.preferredLocale,
    mustChangePassword: row.mustChangePassword,
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await authDb.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, sha256(token)));
  }
  store.delete(SESSION_COOKIE);
}

/** Revoke every session of a user (password change/reset, deactivation). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const rows = await authDb
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  for (const r of rows) {
    if (r.id !== exceptSessionId) {
      await authDb.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, r.id));
    }
  }
}
