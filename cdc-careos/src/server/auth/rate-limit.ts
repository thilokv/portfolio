/**
 * Database-backed sliding-window rate limiter. Works across multiple server
 * instances (unlike an in-memory limiter) and needs no extra service.
 */
import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { authDb } from "@/db";
import { rateLimitEvents } from "@/db/schema";

export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export const RULES = {
  loginByEmail: { bucket: "login_email", limit: 5, windowSeconds: 15 * 60 },
  loginByIp: { bucket: "login_ip", limit: 30, windowSeconds: 15 * 60 },
  passwordReset: { bucket: "pw_reset", limit: 3, windowSeconds: 60 * 60 },
  upload: { bucket: "upload", limit: 30, windowSeconds: 10 * 60 },
  ai: { bucket: "ai", limit: 30, windowSeconds: 10 * 60 },
  parentFeedback: { bucket: "feedback", limit: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export async function isRateLimited(rule: RateLimitRule, key: string): Promise<boolean> {
  const since = new Date(Date.now() - rule.windowSeconds * 1000);
  const [row] = await authDb
    .select({ n: sql<number>`count(*)::int` })
    .from(rateLimitEvents)
    .where(and(eq(rateLimitEvents.bucket, rule.bucket), eq(rateLimitEvents.key, key), gte(rateLimitEvents.createdAt, since)));
  return (row?.n ?? 0) >= rule.limit;
}

export async function recordRateLimitEvent(rule: RateLimitRule, key: string): Promise<void> {
  await authDb.insert(rateLimitEvents).values({ bucket: rule.bucket, key });
  // Opportunistic cleanup of old events (cheap, indexed).
  if (Math.random() < 0.05) {
    await authDb.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, new Date(Date.now() - 24 * 3600 * 1000)));
  }
}

export async function clearRateLimit(rule: RateLimitRule, key: string): Promise<void> {
  await authDb.delete(rateLimitEvents).where(and(eq(rateLimitEvents.bucket, rule.bucket), eq(rateLimitEvents.key, key)));
}

/** Throws a user-safe error if over the limit; otherwise records the event. */
export async function consumeRateLimit(rule: RateLimitRule, key: string): Promise<boolean> {
  if (await isRateLimited(rule, key)) return false;
  await recordRateLimitEvent(rule, key);
  return true;
}
