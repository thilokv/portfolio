/**
 * Child registration & management. Pure domain logic: receives a transaction
 * (already scoped to the actor's organization by RLS) and the actor; performs
 * permission checks itself so it is safe no matter who calls it.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  childAssignments,
  childGuardians,
  children,
  consents,
  guardians,
  organizations,
  orgCounters,
  services,
  staff,
  staffRoles,
  userAccounts,
} from "@/db/schema";
import type {
  ConsentInput,
  GuardianInput,
  RegisterChildInput,
  UpdateChildInput,
} from "@/lib/validation/children";
import { childProfileSchema } from "@/lib/validation/children";
import { isoDateIST } from "@/lib/dates";
import type { ConsentType } from "@/lib/constants";
import type { StaffActor } from "../auth/actor";
import { audit, diff } from "../audit";
import { assertChildAccess, visibleChildIds } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { hashPassword } from "../auth/crypto";
import { nn } from "../text";

function requirePerm(actor: StaffActor, p: StaffActor["permissions"][number]) {
  if (!actor.permissions.includes(p)) throw new ForbiddenError(p);
}

/** Atomically allocates the next child code, e.g. CDC-0001. */
export async function nextChildCode(tx: Tx, orgId: string): Promise<string> {
  const [org] = await tx.select({ prefix: organizations.childIdPrefix }).from(organizations).where(eq(organizations.id, orgId));
  const [row] = await tx
    .insert(orgCounters)
    .values({ organizationId: orgId, name: "child", value: 1 })
    .onConflictDoUpdate({ target: [orgCounters.organizationId, orgCounters.name], set: { value: sql`${orgCounters.value} + 1` } })
    .returning({ value: orgCounters.value });
  return `${org?.prefix ?? "CDC"}-${String(row.value).padStart(4, "0")}`;
}

function profileValues(input: Omit<UpdateChildInput, "id" | "status"> | RegisterChildInput) {
  const p = childProfileSchema.parse(input);
  return {
    fullName: p.fullName,
    preferredName: nn(p.preferredName),
    dateOfBirth: p.dateOfBirth,
    sex: nn(p.sex),
    preferredLanguage: p.preferredLanguage,
    address: nn(p.address),
    emergencyContactName: nn(p.emergencyContactName),
    emergencyContactPhone: nn(p.emergencyContactPhone),
    emergencyContactRelation: nn(p.emergencyContactRelation),
    developmentalHistory: nn(p.developmentalHistory),
    parentConcerns: nn(p.parentConcerns),
    medicalHistory: nn(p.medicalHistory),
    existingReportsSummary: nn(p.existingReportsSummary),
    referralSource: nn(p.referralSource),
  };
}

function guardianValues(g: GuardianInput) {
  return {
    fullName: g.fullName,
    phone: g.phone,
    alternatePhone: nn(g.alternatePhone),
    email: nn(g.email)?.toLowerCase() ?? null,
    preferredLanguage: g.preferredLanguage,
  };
}

export async function registerChild(tx: Tx, actor: StaffActor, input: RegisterChildInput) {
  requirePerm(actor, "children.register");
  const code = await nextChildCode(tx, actor.orgId);
  const [child] = await tx
    .insert(children)
    .values({ ...profileValues(input), organizationId: actor.orgId, childCode: code, status: "active", createdBy: actor.staffId })
    .returning();
  const [guardian] = await tx
    .insert(guardians)
    .values({ ...guardianValues(input.guardian), organizationId: actor.orgId })
    .returning();
  await tx.insert(childGuardians).values({
    organizationId: actor.orgId,
    childId: child.id,
    guardianId: guardian.id,
    relationship: input.guardian.relationship,
    isPrimary: true,
  });
  await tx.insert(consents).values({
    organizationId: actor.orgId,
    childId: child.id,
    consentType: "registration_data_processing",
    status: "granted",
    givenByGuardianId: guardian.id,
    method: "paper_form",
    effectiveDate: isoDateIST(),
    recordedBy: actor.staffId,
  });
  await audit(tx, actor, {
    action: "child.registered",
    entityType: "child",
    entityId: child.id,
    childId: child.id,
    summary: `Registered ${code}`,
  });
  return { id: child.id, code };
}

export async function updateChild(tx: Tx, actor: StaffActor, input: UpdateChildInput) {
  await assertChildAccess(tx, actor, input.id, "canEditProfile");
  const [before] = await tx.select().from(children).where(eq(children.id, input.id));
  if (before.status === "archived") throw new AppError("errors.invalidStatus");
  const values = { ...profileValues(input), status: input.status };
  await tx.update(children).set(values).where(eq(children.id, input.id));
  const changes = diff(before as unknown as Record<string, unknown>, values);
  await audit(tx, actor, {
    action: "child.updated",
    entityType: "child",
    entityId: input.id,
    childId: input.id,
    summary: `Updated ${Object.keys(changes).join(", ") || "no fields"}`,
    changes,
  });
}

export async function archiveChild(tx: Tx, actor: StaffActor, id: string, reason: string) {
  requirePerm(actor, "children.archive");
  await assertChildAccess(tx, actor, id);
  const [before] = await tx.select().from(children).where(eq(children.id, id));
  if (before.status === "archived") throw new AppError("errors.invalidStatus");
  await tx
    .update(children)
    .set({ status: "archived", archivedAt: new Date(), archivedBy: actor.staffId, archiveReason: reason })
    .where(eq(children.id, id));
  await audit(tx, actor, {
    action: "child.archived",
    entityType: "child",
    entityId: id,
    childId: id,
    summary: reason,
    changes: { status: { from: before.status, to: "archived" } },
  });
}

export async function restoreChild(tx: Tx, actor: StaffActor, id: string) {
  requirePerm(actor, "children.archive");
  await assertChildAccess(tx, actor, id);
  const [before] = await tx.select().from(children).where(eq(children.id, id));
  if (before.status !== "archived") throw new AppError("errors.invalidStatus");
  await tx.update(children).set({ status: "active", archivedAt: null, archivedBy: null, archiveReason: null }).where(eq(children.id, id));
  await audit(tx, actor, {
    action: "child.restored",
    entityType: "child",
    entityId: id,
    childId: id,
    changes: { status: { from: "archived", to: "active" } },
  });
}

export const PAGE_SIZE = 20;

export async function listChildren(
  tx: Tx,
  actor: StaffActor,
  query: { q?: string; status?: string; service?: string; page?: number },
) {
  const visible = await visibleChildIds(tx, actor);
  if (visible && visible.length === 0) return { rows: [], total: 0 };
  const where: SQL[] = [];
  if (visible) where.push(inArray(children.id, visible));
  if (query.status && query.status !== "all") where.push(eq(children.status, query.status as never));
  else if (!query.status) where.push(ne(children.status, "archived"));
  if (query.q) {
    const term = `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(children.fullName, term), ilike(children.childCode, term), ilike(children.preferredName, term))!);
  }
  if (query.service) {
    where.push(
      inArray(
        children.id,
        tx
          .select({ id: childAssignments.childId })
          .from(childAssignments)
          .innerJoin(services, eq(services.id, childAssignments.serviceId))
          .where(and(eq(services.code, query.service as never), isNull(childAssignments.endedAt))),
      ),
    );
  }
  const cond = where.length ? and(...where) : undefined;
  const page = query.page ?? 1;
  const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(children).where(cond);
  const rows = await tx
    .select({
      id: children.id,
      childCode: children.childCode,
      fullName: children.fullName,
      preferredName: children.preferredName,
      dateOfBirth: children.dateOfBirth,
      status: children.status,
      preferredLanguage: children.preferredLanguage,
    })
    .from(children)
    .where(cond)
    .orderBy(asc(children.fullName))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const ids = rows.map((r) => r.id);
  const team = ids.length
    ? await tx
        .select({ childId: childAssignments.childId, serviceCode: services.code, staffName: staff.fullName })
        .from(childAssignments)
        .innerJoin(staff, eq(staff.id, childAssignments.staffId))
        .leftJoin(services, eq(services.id, childAssignments.serviceId))
        .where(and(inArray(childAssignments.childId, ids), isNull(childAssignments.endedAt)))
    : [];
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      services: [...new Set(team.filter((t) => t.childId === r.id && t.serviceCode).map((t) => t.serviceCode!))],
    })),
  };
}

export async function getChild(tx: Tx, actor: StaffActor, id: string) {
  const access = await assertChildAccess(tx, actor, id);
  const [child] = await tx.select().from(children).where(eq(children.id, id));
  return { child, access };
}

export async function listGuardians(tx: Tx, actor: StaffActor, childId: string) {
  await assertChildAccess(tx, actor, childId);
  return tx
    .select({
      id: guardians.id,
      fullName: guardians.fullName,
      phone: guardians.phone,
      alternatePhone: guardians.alternatePhone,
      email: guardians.email,
      preferredLanguage: guardians.preferredLanguage,
      address: guardians.address,
      userId: guardians.userId,
      relationship: childGuardians.relationship,
      isPrimary: childGuardians.isPrimary,
      hasLegalAuthority: childGuardians.hasLegalAuthority,
      portalAccess: childGuardians.portalAccess,
    })
    .from(childGuardians)
    .innerJoin(guardians, eq(guardians.id, childGuardians.guardianId))
    .where(eq(childGuardians.childId, childId))
    .orderBy(desc(childGuardians.isPrimary), asc(guardians.fullName));
}

export async function addGuardian(tx: Tx, actor: StaffActor, childId: string, input: GuardianInput & { isPrimary: boolean }) {
  await assertChildAccess(tx, actor, childId, "canEditProfile");
  const [g] = await tx.insert(guardians).values({ ...guardianValues(input), organizationId: actor.orgId }).returning();
  if (input.isPrimary) {
    await tx.update(childGuardians).set({ isPrimary: false }).where(eq(childGuardians.childId, childId));
  }
  await tx.insert(childGuardians).values({
    organizationId: actor.orgId,
    childId,
    guardianId: g.id,
    relationship: input.relationship,
    isPrimary: input.isPrimary,
  });
  await audit(tx, actor, { action: "guardian.added", entityType: "guardian", entityId: g.id, childId, summary: input.relationship });
  return g.id;
}

/** Most recent consent record per type for a child. */
export async function latestConsents(tx: Tx, childId: string) {
  const rows = await tx
    .select({
      id: consents.id,
      consentType: consents.consentType,
      status: consents.status,
      method: consents.method,
      effectiveDate: consents.effectiveDate,
      notes: consents.notes,
      createdAt: consents.createdAt,
      guardianName: guardians.fullName,
      recordedByName: staff.fullName,
    })
    .from(consents)
    .leftJoin(guardians, eq(guardians.id, consents.givenByGuardianId))
    .innerJoin(staff, eq(staff.id, consents.recordedBy))
    .where(eq(consents.childId, childId))
    .orderBy(desc(consents.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.consentType)) latest.set(r.consentType, r);
  return { latest, history: rows };
}

export async function hasConsent(tx: Tx, childId: string, type: ConsentType): Promise<boolean> {
  const [row] = await tx
    .select({ status: consents.status })
    .from(consents)
    .where(and(eq(consents.childId, childId), eq(consents.consentType, type)))
    .orderBy(desc(consents.createdAt))
    .limit(1);
  return row?.status === "granted";
}

export async function recordConsent(tx: Tx, actor: StaffActor, input: ConsentInput) {
  requirePerm(actor, "consent.manage");
  await assertChildAccess(tx, actor, input.childId);
  const [row] = await tx
    .insert(consents)
    .values({
      organizationId: actor.orgId,
      childId: input.childId,
      consentType: input.consentType,
      status: input.status,
      givenByGuardianId: nn(input.givenByGuardianId),
      method: input.method,
      effectiveDate: input.effectiveDate,
      notes: nn(input.notes),
      recordedBy: actor.staffId,
    })
    .returning({ id: consents.id });
  // Withdrawing portal consent immediately removes portal access.
  if (input.consentType === "parent_portal" && input.status !== "granted") {
    await tx.update(childGuardians).set({ portalAccess: false }).where(eq(childGuardians.childId, input.childId));
  }
  await audit(tx, actor, {
    action: "consent.recorded",
    entityType: "consent",
    entityId: row.id,
    childId: input.childId,
    summary: `${input.consentType}: ${input.status}`,
  });
}

/* ------------------------------------------------------------ care team */

export async function listCareTeam(tx: Tx, childId: string) {
  return tx
    .select({
      id: childAssignments.id,
      staffId: staff.id,
      staffName: staff.fullName,
      serviceId: childAssignments.serviceId,
      serviceCode: services.code,
      isLead: childAssignments.isLead,
      startedAt: childAssignments.startedAt,
    })
    .from(childAssignments)
    .innerJoin(staff, eq(staff.id, childAssignments.staffId))
    .leftJoin(services, eq(services.id, childAssignments.serviceId))
    .where(and(eq(childAssignments.childId, childId), isNull(childAssignments.endedAt)))
    .orderBy(desc(childAssignments.isLead), asc(staff.fullName));
}

export async function assignStaff(
  tx: Tx,
  actor: StaffActor,
  input: { childId: string; staffId: string; serviceId: string; isLead: boolean },
) {
  requirePerm(actor, "care_team.manage");
  await assertChildAccess(tx, actor, input.childId);
  const [member] = await tx.select().from(staff).where(eq(staff.id, input.staffId));
  if (!member || !member.isActive) throw new NotFoundError("staff");
  await tx.insert(childAssignments).values({
    organizationId: actor.orgId,
    childId: input.childId,
    staffId: input.staffId,
    serviceId: nn(input.serviceId),
    isLead: input.isLead,
    assignedBy: actor.staffId,
  });
  await audit(tx, actor, {
    action: "care_team.assigned",
    entityType: "child_assignment",
    childId: input.childId,
    summary: `Assigned ${member.fullName}`,
  });
}

export async function removeFromCareTeam(tx: Tx, actor: StaffActor, assignmentId: string) {
  requirePerm(actor, "care_team.manage");
  const [a] = await tx.select().from(childAssignments).where(eq(childAssignments.id, assignmentId));
  if (!a || a.endedAt) throw new NotFoundError("assignment");
  await tx.update(childAssignments).set({ endedAt: new Date() }).where(eq(childAssignments.id, assignmentId));
  await audit(tx, actor, { action: "care_team.removed", entityType: "child_assignment", entityId: assignmentId, childId: a.childId });
}

/** Active clinical staff (for assignment pickers). */
export async function listClinicalStaff(tx: Tx) {
  const rows = await tx
    .select({ id: staff.id, fullName: staff.fullName, role: staffRoles.role })
    .from(staff)
    .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
    .where(and(eq(staff.isActive, true), ne(staffRoles.role, "admin")))
    .orderBy(asc(staff.fullName));
  const map = new Map<string, { id: string; fullName: string; roles: string[] }>();
  for (const r of rows) {
    const e = map.get(r.id) ?? { id: r.id, fullName: r.fullName, roles: [] };
    e.roles.push(r.role);
    map.set(r.id, e);
  }
  return [...map.values()];
}

/* ------------------------------------------------------- portal accounts */

export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) out += i % 4 === 3 ? digits[bytes[i] % digits.length] : alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function enableGuardianPortal(tx: Tx, actor: StaffActor, childId: string, guardianId: string) {
  requirePerm(actor, "consent.manage");
  await assertChildAccess(tx, actor, childId);
  if (!(await hasConsent(tx, childId, "parent_portal"))) throw new AppError("children.portalNeedsConsent");
  const [link] = await tx
    .select()
    .from(childGuardians)
    .where(and(eq(childGuardians.childId, childId), eq(childGuardians.guardianId, guardianId)));
  if (!link) throw new NotFoundError("guardian");
  const [g] = await tx.select().from(guardians).where(eq(guardians.id, guardianId));
  if (!g.email) throw new AppError("children.portalNeedsEmail");
  let password: string | null = null;
  if (!g.userId) {
    password = generateTempPassword();
    const [user] = await tx
      .insert(userAccounts)
      .values({
        organizationId: actor.orgId,
        email: g.email,
        passwordHash: await hashPassword(password),
        accountType: "guardian",
        mustChangePassword: true,
        preferredLocale: g.preferredLanguage === "en" ? "en" : "te",
      })
      .returning({ id: userAccounts.id });
    await tx.update(guardians).set({ userId: user.id }).where(eq(guardians.id, guardianId));
  }
  await tx
    .update(childGuardians)
    .set({ portalAccess: true })
    .where(and(eq(childGuardians.childId, childId), eq(childGuardians.guardianId, guardianId)));
  await audit(tx, actor, { action: "guardian.portal_enabled", entityType: "guardian", entityId: guardianId, childId });
  return { password };
}
