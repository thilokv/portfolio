"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { authDb, withOrg } from "@/db";
import { passwordResetTokens, userAccounts } from "@/db/schema";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { generateToken, getDummyHash, hashPassword, sha256, verifyPassword } from "../auth/crypto";
import { createSession, destroySession, getClientIp, readSession, revokeAllSessions } from "../auth/session";
import { clearRateLimit, consumeRateLimit, isRateLimited, recordRateLimitEvent, RULES } from "../auth/rate-limit";
import { getActor } from "../auth/actor";
import { audit } from "../audit";
import { runAction } from "../action";
import { sendMail } from "../mail";
import type { ActionResult } from "../errors";
import { z } from "zod";

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

async function setLocaleCookie(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600, httpOnly: false });
}

export async function loginAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(loginSchema, input, async ({ email, password }) => {
    const ip = await getClientIp();
    const emailKey = email.toLowerCase();
    if ((await isRateLimited(RULES.loginByEmail, emailKey)) || (await isRateLimited(RULES.loginByIp, ip))) {
      return { ok: false, error: "auth.rateLimited" };
    }
    const [user] = await authDb
      .select()
      .from(userAccounts)
      .where(sql`lower(${userAccounts.email}) = ${emailKey}`)
      .limit(1);

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return { ok: false, error: "auth.accountLocked" };
    }
    const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, await getDummyHash());
    if (!user || !valid || !user.isActive) {
      await recordRateLimitEvent(RULES.loginByEmail, emailKey);
      await recordRateLimitEvent(RULES.loginByIp, ip);
      if (user) {
        const failed = user.failedLoginCount + 1;
        await authDb
          .update(userAccounts)
          .set({
            failedLoginCount: failed >= LOCK_AFTER ? 0 : failed,
            lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
          })
          .where(eq(userAccounts.id, user.id));
        await withOrg({ orgId: user.organizationId }, (tx) =>
          audit(tx, null, {
            action: failed >= LOCK_AFTER ? "auth.locked" : "auth.login_failed",
            entityType: "user_account",
            entityId: user.id,
            changes: { organizationId: user.organizationId },
          }, ip),
        );
        if (failed >= LOCK_AFTER) return { ok: false, error: "auth.accountLocked" };
      }
      return { ok: false, error: "auth.invalidCredentials" };
    }

    await authDb
      .update(userAccounts)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(userAccounts.id, user.id));
    await clearRateLimit(RULES.loginByEmail, emailKey);
    await createSession(user.id);
    if (isLocale(user.preferredLocale)) await setLocaleCookie(user.preferredLocale);
    await withOrg({ orgId: user.organizationId }, (tx) =>
      audit(tx, { kind: user.accountType, userId: user.id, orgId: user.organizationId, name: user.email }, {
        action: "auth.login",
        entityType: "user_account",
        entityId: user.id,
      }, ip),
    );
    const redirectTo = user.mustChangePassword
      ? user.accountType === "guardian" ? "/portal/profile?mustChange=1" : "/settings?mustChange=1"
      : user.accountType === "guardian"
        ? "/portal"
        : "/dashboard";
    return { ok: true, data: { redirectTo } };
  });
}

export async function logoutAction(): Promise<void> {
  const actor = await getActor();
  if (actor) {
    await withOrg({ orgId: actor.orgId }, (tx) => audit(tx, actor, { action: "auth.logout", entityType: "user_account", entityId: actor.userId }));
  }
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(forgotPasswordSchema, input, async ({ email }) => {
    const ip = await getClientIp();
    if (!(await consumeRateLimit(RULES.passwordReset, ip)) || !(await consumeRateLimit(RULES.passwordReset, email.toLowerCase()))) {
      return { ok: false, error: "auth.rateLimited" };
    }
    const [user] = await authDb
      .select()
      .from(userAccounts)
      .where(sql`lower(${userAccounts.email}) = ${email.toLowerCase()}`)
      .limit(1);
    // Always respond the same way so the form cannot be used to discover accounts.
    if (user && user.isActive) {
      const token = generateToken();
      await authDb.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail(user.email, "CDC CareOS password reset", `Use this link within 30 minutes to reset your password:\n${url}\n\nIf you did not request this, ignore this message.`);
      await withOrg({ orgId: user.organizationId }, (tx) =>
        audit(tx, null, { action: "auth.reset_requested", entityType: "user_account", entityId: user.id, changes: { organizationId: user.organizationId } }, ip),
      );
    }
    return { ok: true, message: "auth.resetSent" };
  });
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(resetPasswordSchema, input, async ({ token, password }) => {
    const [row] = await authDb
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .limit(1);
    if (!row) return { ok: false, error: "auth.resetInvalid" };
    const [user] = await authDb.select().from(userAccounts).where(eq(userAccounts.id, row.userId)).limit(1);
    if (!user || !user.isActive) return { ok: false, error: "auth.resetInvalid" };
    await authDb.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await authDb
      .update(userAccounts)
      .set({ passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null })
      .where(eq(userAccounts.id, user.id));
    await revokeAllSessions(user.id);
    await withOrg({ orgId: user.organizationId }, (tx) =>
      audit(tx, null, { action: "auth.password_reset", entityType: "user_account", entityId: user.id, changes: { organizationId: user.organizationId } }),
    );
    return { ok: true, message: "auth.resetDone" };
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(changePasswordSchema, input, async ({ currentPassword, password }) => {
    const session = await readSession();
    const actor = await getActor();
    if (!session || !actor) return { ok: false, error: "errors.forbidden" };
    const [user] = await authDb.select().from(userAccounts).where(eq(userAccounts.id, session.userId)).limit(1);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, error: "auth.invalidCredentials", fieldErrors: { currentPassword: "auth.invalidCredentials" } };
    }
    await authDb
      .update(userAccounts)
      .set({ passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() })
      .where(eq(userAccounts.id, user.id));
    await revokeAllSessions(user.id, session.sessionId);
    await withOrg({ orgId: actor.orgId }, (tx) => audit(tx, actor, { action: "auth.password_changed", entityType: "user_account", entityId: user.id }));
    return { ok: true, message: "auth.passwordChanged", data: { redirectTo: actor.kind === "guardian" ? "/portal" : "/dashboard" } };
  });
}

export async function signOutOtherSessionsAction(): Promise<ActionResult> {
  const session = await readSession();
  if (!session) return { ok: false, error: "errors.forbidden" };
  await revokeAllSessions(session.userId, session.sessionId);
  return { ok: true, message: "settings.signedOutOthers" };
}

export async function setLocaleAction(locale: string): Promise<ActionResult> {
  return runAction(z.enum(["en", "te"]), locale, async (value) => {
    await setLocaleCookie(value);
    const session = await readSession();
    if (session) await authDb.update(userAccounts).set({ preferredLocale: value }).where(eq(userAccounts.id, session.userId));
    return { ok: true };
  });
}
