/**
 * Parent portal data access. Runs with app.guardian_id set, so PostgreSQL RLS
 * only returns rows for this guardian's portal-enabled children, shared
 * reports, sent messages and family-visible documents. Every query also
 * filters explicitly by the guardian's children (defense in depth).
 * Internal clinical notes, assessments and restricted records are never read.
 */
import { and, asc, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import type { Tx } from "@/db";
import { appointments, childGuardians, children, documents, guardians, parentMessages, reports, services, staff } from "@/db/schema";
import type { GuardianActor } from "../auth/actor";
import { audit } from "../audit";
import { AppError, NotFoundError } from "../errors";
import { nn } from "../text";

export async function portalChildIds(tx: Tx, actor: GuardianActor): Promise<string[]> {
  const rows = await tx
    .select({ childId: childGuardians.childId })
    .from(childGuardians)
    .where(and(eq(childGuardians.guardianId, actor.guardianId), eq(childGuardians.portalAccess, true)));
  return rows.map((r) => r.childId);
}

export async function portalChildren(tx: Tx, actor: GuardianActor) {
  const ids = await portalChildIds(tx, actor);
  if (!ids.length) return [];
  return tx
    .select({ id: children.id, fullName: children.fullName, preferredName: children.preferredName, childCode: children.childCode, dateOfBirth: children.dateOfBirth })
    .from(children)
    .where(and(inArray(children.id, ids), ne(children.status, "archived")))
    .orderBy(asc(children.fullName));
}

export async function portalAppointments(tx: Tx, actor: GuardianActor, upcomingOnly = true) {
  const ids = await portalChildIds(tx, actor);
  if (!ids.length) return [];
  return tx
    .select({ id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, room: appointments.room, serviceCode: services.code, serviceNameTe: services.nameTe, staffName: staff.fullName, childName: children.fullName })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(children, eq(children.id, appointments.childId))
    .where(and(inArray(appointments.childId, ids), upcomingOnly ? gte(appointments.startsAt, new Date(Date.now() - 2 * 3600_000)) : undefined))
    .orderBy(upcomingOnly ? asc(appointments.startsAt) : desc(appointments.startsAt))
    .limit(50);
}

export async function portalReports(tx: Tx, actor: GuardianActor) {
  const ids = await portalChildIds(tx, actor);
  if (!ids.length) return [];
  return tx
    .select({ id: reports.id, title: reports.title, reportType: reports.reportType, content: reports.content, contentTe: reports.contentTe, teReviewed: reports.teTranslationReviewedBy, sharedAt: reports.sharedAt, periodStart: reports.periodStart, periodEnd: reports.periodEnd, childName: children.fullName })
    .from(reports)
    .innerJoin(children, eq(children.id, reports.childId))
    .where(and(inArray(reports.childId, ids), eq(reports.status, "shared")))
    .orderBy(desc(reports.sharedAt));
}

export async function portalReport(tx: Tx, actor: GuardianActor, id: string) {
  const rows = await portalReports(tx, actor);
  const r = rows.find((x) => x.id === id);
  if (!r) throw new NotFoundError("report");
  await audit(tx, actor, { action: "portal.report_viewed", entityType: "report", entityId: id });
  return r;
}

export async function portalMessages(tx: Tx, actor: GuardianActor, kind?: "home_activity") {
  const ids = await portalChildIds(tx, actor);
  if (!ids.length) return [];
  const rows = await tx
    .select({ m: parentMessages, staffName: staff.fullName, childName: children.fullName })
    .from(parentMessages)
    .innerJoin(children, eq(children.id, parentMessages.childId))
    .leftJoin(staff, eq(staff.id, parentMessages.senderStaffId))
    .where(
      and(
        inArray(parentMessages.childId, ids),
        eq(parentMessages.status, "sent"),
        kind ? eq(parentMessages.kind, kind) : undefined,
      ),
    )
    .orderBy(desc(parentMessages.createdAt))
    .limit(100);
  // Only this guardian's own outgoing messages, plus everything sent to the family.
  return rows.filter((r) => r.m.direction === "to_guardian" || r.m.senderGuardianId === actor.guardianId);
}

export async function markMessagesRead(tx: Tx, actor: GuardianActor, messageIds: string[]) {
  if (!messageIds.length) return;
  await tx
    .update(parentMessages)
    .set({ readAt: new Date() })
    .where(and(inArray(parentMessages.id, messageIds), eq(parentMessages.direction, "to_guardian"), isNull(parentMessages.readAt)));
}

export async function sendFeedback(tx: Tx, actor: GuardianActor, input: { childId: string; subject: string; body: string }) {
  const ids = await portalChildIds(tx, actor);
  if (!ids.includes(input.childId)) throw new NotFoundError("child");
  await tx.insert(parentMessages).values({
    organizationId: actor.orgId,
    childId: input.childId,
    kind: "feedback",
    direction: "from_guardian",
    senderGuardianId: actor.guardianId,
    subject: input.subject,
    body: input.body,
    status: "sent",
    sentAt: new Date(),
  });
  await audit(tx, actor, { action: "portal.feedback_sent", entityType: "parent_message", childId: input.childId });
}

export async function portalProfile(tx: Tx, actor: GuardianActor) {
  const [g] = await tx.select().from(guardians).where(eq(guardians.id, actor.guardianId));
  return g;
}

export async function updateContact(
  tx: Tx,
  actor: GuardianActor,
  input: { phone: string; alternatePhone: string; address: string; preferredLanguage: "te" | "en" | "hi" | "ur" | "other" },
) {
  const [before] = await tx.select().from(guardians).where(eq(guardians.id, actor.guardianId));
  if (!before) throw new AppError("errors.notFound");
  await tx
    .update(guardians)
    .set({ phone: input.phone, alternatePhone: nn(input.alternatePhone), address: nn(input.address), preferredLanguage: input.preferredLanguage })
    .where(eq(guardians.id, actor.guardianId));
  // Notify the care team via each linked child's communication log.
  for (const childId of await portalChildIds(tx, actor)) {
    await tx.insert(parentMessages).values({
      organizationId: actor.orgId,
      childId,
      kind: "contact_update",
      direction: "from_guardian",
      senderGuardianId: actor.guardianId,
      subject: "Contact details updated",
      body: `Phone: ${input.phone}${input.alternatePhone ? `, alternate: ${input.alternatePhone}` : ""}${input.address ? `\nAddress: ${input.address}` : ""}`,
      status: "sent",
      sentAt: new Date(),
    });
  }
  await audit(tx, actor, {
    action: "portal.contact_updated",
    entityType: "guardian",
    entityId: actor.guardianId,
    changes: { phone: { from: before.phone, to: input.phone } },
  });
}

export async function portalDocuments(tx: Tx, actor: GuardianActor) {
  const ids = await portalChildIds(tx, actor);
  if (!ids.length) return [];
  return tx
    .select({ id: documents.id, title: documents.title, category: documents.category, createdAt: documents.createdAt, childName: children.fullName })
    .from(documents)
    .innerJoin(children, eq(children.id, documents.childId))
    .where(and(inArray(documents.childId, ids), eq(documents.visibleToGuardians, true), eq(documents.isRestricted, false), isNull(documents.archivedAt)))
    .orderBy(desc(documents.createdAt));
}
