/**
 * The Data Access Layer entry point: resolves the signed-in user into an
 * "actor" with organization, roles and permissions. Every server component,
 * server action and route handler must obtain the actor from here.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { withOrg } from "@/db";
import { guardians, staff, staffRoles } from "@/db/schema";
import { permissionsFor, type Permission } from "@/lib/permissions";
import type { StaffRole } from "@/lib/constants";
import { ForbiddenError } from "../errors";
import { readSession } from "./session";

export interface StaffActor {
  kind: "staff";
  userId: string;
  orgId: string;
  staffId: string;
  name: string;
  email: string;
  roles: StaffRole[];
  permissions: Permission[];
  locale: string;
  mustChangePassword: boolean;
}
export interface GuardianActor {
  kind: "guardian";
  userId: string;
  orgId: string;
  guardianId: string;
  name: string;
  email: string;
  locale: string;
  mustChangePassword: boolean;
}
export type Actor = StaffActor | GuardianActor;

export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await readSession();
  if (!session) return null;
  const orgId = session.organizationId;
  if (session.accountType === "staff") {
    return withOrg({ orgId }, async (tx) => {
      const [s] = await tx.select().from(staff).where(eq(staff.userId, session.userId)).limit(1);
      if (!s || !s.isActive) return null;
      const roles = (await tx.select({ role: staffRoles.role }).from(staffRoles).where(eq(staffRoles.staffId, s.id))).map(
        (r) => r.role,
      );
      return {
        kind: "staff",
        userId: session.userId,
        orgId,
        staffId: s.id,
        name: s.fullName,
        email: session.email,
        roles,
        permissions: [...permissionsFor(roles)],
        locale: session.preferredLocale,
        mustChangePassword: session.mustChangePassword,
      } satisfies StaffActor;
    });
  }
  const [g] = await withOrg({ orgId }, (tx) =>
    tx.select().from(guardians).where(eq(guardians.userId, session.userId)).limit(1),
  );
  if (!g) return null;
  return {
    kind: "guardian",
    userId: session.userId,
    orgId,
    guardianId: g.id,
    name: g.fullName,
    email: session.email,
    locale: session.preferredLocale,
    mustChangePassword: session.mustChangePassword,
  };
});

/** For pages: redirects unauthenticated users; 403s missing permissions. */
export async function requireStaffPage(permission?: Permission): Promise<StaffActor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.kind !== "staff") redirect("/portal");
  if (permission && !actor.permissions.includes(permission)) redirect("/forbidden");
  return actor;
}

export async function requireGuardianPage(): Promise<GuardianActor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.kind !== "guardian") redirect("/dashboard");
  return actor;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireStaff(permission?: Permission): Promise<StaffActor> {
  const actor = await getActor();
  if (!actor || actor.kind !== "staff") throw new ForbiddenError("not staff");
  if (permission && !actor.permissions.includes(permission)) throw new ForbiddenError(permission);
  return actor;
}

export async function requireGuardian(): Promise<GuardianActor> {
  const actor = await getActor();
  if (!actor || actor.kind !== "guardian") throw new ForbiddenError("not guardian");
  return actor;
}

export function can(actor: StaffActor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

export function staffCtx(actor: StaffActor) {
  return { orgId: actor.orgId };
}
export function guardianCtx(actor: GuardianActor) {
  return { orgId: actor.orgId, guardianId: actor.guardianId };
}
