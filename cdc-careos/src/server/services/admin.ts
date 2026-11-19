/** Staff, roles, availability and service configuration (administrators). */
import { and, asc, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { authSessions, services, staff, staffAvailability, staffRoles, userAccounts } from "@/db/schema";
import type { AvailabilityInput, ServiceUpdateInput, StaffInput } from "@/lib/validation/admin";
import { isoDateIST } from "@/lib/dates";
import type { StaffActor } from "../auth/actor";
import { audit, diff } from "../audit";
import { hashPassword } from "../auth/crypto";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { generateTempPassword } from "./children";
import { nn } from "../text";

function requireManage(actor: StaffActor) {
  if (!actor.permissions.includes("staff.manage")) throw new ForbiddenError("staff.manage");
}

export async function listStaff(tx: Tx, actor: StaffActor) {
  requireManage(actor);
  const rows = await tx
    .select({ s: staff, email: userAccounts.email, lastLoginAt: userAccounts.lastLoginAt, lockedUntil: userAccounts.lockedUntil })
    .from(staff)
    .innerJoin(userAccounts, eq(userAccounts.id, staff.userId))
    .orderBy(desc(staff.isActive), asc(staff.fullName));
  const roles = await tx.select().from(staffRoles);
  const today = isoDateIST();
  const avail = await tx
    .select()
    .from(staffAvailability)
    .where(gte(staffAvailability.date, today))
    .orderBy(asc(staffAvailability.date));
  return rows.map(({ s, email, lastLoginAt, lockedUntil }) => ({
    ...s,
    email,
    lastLoginAt,
    locked: !!lockedUntil && lockedUntil.getTime() > Date.now(),
    roles: roles.filter((r) => r.staffId === s.id).map((r) => r.role),
    availability: avail.filter((a) => a.staffId === s.id).slice(0, 5),
  }));
}

async function activeAdminCount(tx: Tx, excludeStaffId?: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(distinct ${staff.id})::int` })
    .from(staff)
    .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
    .where(and(eq(staffRoles.role, "admin"), eq(staff.isActive, true), excludeStaffId ? ne(staff.id, excludeStaffId) : undefined));
  return n;
}

export async function createStaff(tx: Tx, actor: StaffActor, input: StaffInput) {
  requireManage(actor);
  const email = input.email.toLowerCase();
  const [exists] = await tx.select({ id: userAccounts.id }).from(userAccounts).where(sql`lower(${userAccounts.email}) = ${email}`);
  if (exists) throw new AppError("errors.duplicate");
  const password = generateTempPassword();
  const [user] = await tx
    .insert(userAccounts)
    .values({ organizationId: actor.orgId, email, passwordHash: await hashPassword(password), accountType: "staff", mustChangePassword: true })
    .returning({ id: userAccounts.id });
  const [s] = await tx
    .insert(staff)
    .values({
      organizationId: actor.orgId,
      userId: user.id,
      fullName: input.fullName,
      phone: nn(input.phone),
      designation: nn(input.designation),
      qualifications: nn(input.qualifications),
      registrationNumber: nn(input.registrationNumber),
    })
    .returning({ id: staff.id });
  for (const role of new Set(input.roles)) {
    await tx.insert(staffRoles).values({ organizationId: actor.orgId, staffId: s.id, role, grantedBy: actor.staffId });
  }
  await audit(tx, actor, { action: "staff.created", entityType: "staff", entityId: s.id, summary: `${input.fullName}: ${input.roles.join(", ")}` });
  return { id: s.id, password };
}

export async function updateStaff(tx: Tx, actor: StaffActor, input: StaffInput & { id: string }) {
  requireManage(actor);
  const [before] = await tx.select().from(staff).where(eq(staff.id, input.id));
  if (!before) throw new NotFoundError("staff");
  const oldRoles = (await tx.select({ role: staffRoles.role }).from(staffRoles).where(eq(staffRoles.staffId, input.id))).map((r) => r.role);
  const newRoles = [...new Set(input.roles)];
  if (oldRoles.includes("admin") && !newRoles.includes("admin") && (await activeAdminCount(tx, input.id)) === 0) {
    throw new AppError("admin.lastAdmin");
  }
  const values = {
    fullName: input.fullName,
    phone: nn(input.phone),
    designation: nn(input.designation),
    qualifications: nn(input.qualifications),
    registrationNumber: nn(input.registrationNumber),
  };
  await tx.update(staff).set(values).where(eq(staff.id, input.id));
  const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, before.userId));
  if (account.organizationId !== actor.orgId) throw new ForbiddenError("org");
  if (account.email.toLowerCase() !== input.email.toLowerCase()) {
    const [exists] = await tx.select({ id: userAccounts.id }).from(userAccounts).where(sql`lower(${userAccounts.email}) = ${input.email.toLowerCase()}`);
    if (exists) throw new AppError("errors.duplicate");
    await tx.update(userAccounts).set({ email: input.email.toLowerCase() }).where(eq(userAccounts.id, account.id));
  }
  const removed = oldRoles.filter((r) => !newRoles.includes(r));
  const added = newRoles.filter((r) => !oldRoles.includes(r));
  if (removed.length) await tx.delete(staffRoles).where(and(eq(staffRoles.staffId, input.id), inArray(staffRoles.role, removed)));
  for (const role of added) await tx.insert(staffRoles).values({ organizationId: actor.orgId, staffId: input.id, role, grantedBy: actor.staffId });
  await audit(tx, actor, {
    action: "staff.updated",
    entityType: "staff",
    entityId: input.id,
    summary: [added.length ? `+${added.join(",")}` : "", removed.length ? `-${removed.join(",")}` : ""].filter(Boolean).join(" ") || undefined,
    changes: { ...diff(before as unknown as Record<string, unknown>, values), ...(added.length || removed.length ? { roles: { from: oldRoles, to: newRoles } } : {}) },
  });
}

export async function setStaffActive(tx: Tx, actor: StaffActor, staffId: string, active: boolean) {
  requireManage(actor);
  if (staffId === actor.staffId && !active) throw new AppError("admin.cannotDeactivateSelf");
  const [s] = await tx.select().from(staff).where(eq(staff.id, staffId));
  if (!s) throw new NotFoundError("staff");
  if (!active) {
    const isAdmin = (await tx.select().from(staffRoles).where(and(eq(staffRoles.staffId, staffId), eq(staffRoles.role, "admin")))).length > 0;
    if (isAdmin && (await activeAdminCount(tx, staffId)) === 0) throw new AppError("admin.lastAdmin");
  }
  await tx.update(staff).set({ isActive: active }).where(eq(staff.id, staffId));
  await tx.update(userAccounts).set({ isActive: active }).where(and(eq(userAccounts.id, s.userId), eq(userAccounts.organizationId, actor.orgId)));
  if (!active) await tx.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, s.userId), isNull(authSessions.revokedAt)));
  await audit(tx, actor, { action: active ? "staff.activated" : "staff.deactivated", entityType: "staff", entityId: staffId, summary: s.fullName });
}

export async function resetStaffPassword(tx: Tx, actor: StaffActor, staffId: string) {
  requireManage(actor);
  const [s] = await tx.select().from(staff).where(eq(staff.id, staffId));
  if (!s) throw new NotFoundError("staff");
  const password = generateTempPassword();
  await tx
    .update(userAccounts)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null })
    .where(and(eq(userAccounts.id, s.userId), eq(userAccounts.organizationId, actor.orgId)));
  await tx.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, s.userId), isNull(authSessions.revokedAt)));
  await audit(tx, actor, { action: "staff.password_reset", entityType: "staff", entityId: staffId, summary: s.fullName });
  return password;
}

export async function setAvailability(tx: Tx, actor: StaffActor, input: AvailabilityInput) {
  requireManage(actor);
  await tx
    .insert(staffAvailability)
    .values({ organizationId: actor.orgId, staffId: input.staffId, date: input.date, status: input.status, note: nn(input.note), createdBy: actor.staffId })
    .onConflictDoUpdate({ target: [staffAvailability.staffId, staffAvailability.date], set: { status: input.status, note: nn(input.note) } });
  await audit(tx, actor, { action: "staff.availability_set", entityType: "staff", entityId: input.staffId, summary: `${input.date}: ${input.status}` });
}

export async function removeAvailability(tx: Tx, actor: StaffActor, id: string) {
  requireManage(actor);
  const [row] = await tx.delete(staffAvailability).where(eq(staffAvailability.id, id)).returning();
  if (row) await audit(tx, actor, { action: "staff.availability_removed", entityType: "staff", entityId: row.staffId, summary: row.date });
}

export async function updateService(tx: Tx, actor: StaffActor, input: ServiceUpdateInput) {
  if (!actor.permissions.includes("services.manage")) throw new ForbiddenError("services.manage");
  const [before] = await tx.select().from(services).where(eq(services.id, input.id));
  if (!before) throw new NotFoundError("service");
  const values = { name: input.name, nameTe: nn(input.nameTe), description: nn(input.description), defaultDurationMinutes: Number(input.defaultDurationMinutes), isActive: input.isActive };
  await tx.update(services).set(values).where(eq(services.id, input.id));
  await audit(tx, actor, { action: "service.updated", entityType: "service", entityId: input.id, changes: diff(before as unknown as Record<string, unknown>, values) });
}
