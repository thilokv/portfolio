/** Parent communication and clinical reports (approval → sharing workflow). */
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "@/db";
import { children, guardians, parentMessages, reports, staff } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import type { MessageInput, ReportInput } from "@/lib/validation/communication";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { hasConsent } from "./children";
import { periodSummary } from "./progress";
import { nn } from "../text";

export async function listMessages(tx: Tx, actor: StaffActor, childId: string) {
  await assertChildAccess(tx, actor, childId, "canViewClinical");
  const sender = alias(staff, "sender");
  return tx
    .select({
      m: parentMessages,
      staffName: sender.fullName,
      guardianName: guardians.fullName,
    })
    .from(parentMessages)
    .leftJoin(sender, eq(sender.id, parentMessages.senderStaffId))
    .leftJoin(guardians, eq(guardians.id, parentMessages.senderGuardianId))
    .where(eq(parentMessages.childId, childId))
    .orderBy(desc(parentMessages.createdAt));
}

export async function sendMessage(tx: Tx, actor: StaffActor, input: MessageInput) {
  if (!actor.permissions.includes("messages.send")) throw new ForbiddenError("messages.send");
  await assertChildAccess(tx, actor, input.childId, "canWriteClinical");
  const [row] = await tx
    .insert(parentMessages)
    .values({
      organizationId: actor.orgId,
      childId: input.childId,
      kind: input.kind,
      direction: "to_guardian",
      senderStaffId: actor.staffId,
      subject: input.subject,
      body: input.body,
      bodyTe: nn(input.bodyTe),
      teTranslationReviewedBy: nn(input.bodyTe) ? actor.staffId : null,
      status: "sent",
      sentAt: new Date(),
    })
    .returning({ id: parentMessages.id });
  await audit(tx, actor, { action: "message.sent", entityType: "parent_message", entityId: row.id, childId: input.childId, summary: input.subject });
}

export async function acknowledgeMessage(tx: Tx, actor: StaffActor, messageId: string) {
  const [m] = await tx.select().from(parentMessages).where(eq(parentMessages.id, messageId));
  if (!m) throw new NotFoundError("message");
  await assertChildAccess(tx, actor, m.childId, "canViewClinical");
  if (m.direction !== "from_guardian") throw new AppError("errors.invalidStatus");
  await tx.update(parentMessages).set({ acknowledgedBy: actor.staffId, acknowledgedAt: new Date() }).where(and(eq(parentMessages.id, messageId), isNull(parentMessages.acknowledgedAt)));
  await audit(tx, actor, { action: "message.acknowledged", entityType: "parent_message", entityId: messageId, childId: m.childId });
}

/* -------------------------------------------------------------- reports */

export async function listReports(tx: Tx, actor: StaffActor, childId: string) {
  const access = await assertChildAccess(tx, actor, childId, "canViewClinical");
  const author = alias(staff, "author");
  const approver = alias(staff, "approver");
  const rows = await tx
    .select({ r: reports, authorName: author.fullName, approverName: approver.fullName })
    .from(reports)
    .innerJoin(author, eq(author.id, reports.authorStaffId))
    .leftJoin(approver, eq(approver.id, reports.approvedBy))
    .where(eq(reports.childId, childId))
    .orderBy(desc(reports.createdAt));
  return rows.map(({ r, authorName, approverName }) => {
    const hidden = r.isRestricted && !access.canViewRestricted && r.authorStaffId !== actor.staffId;
    return {
      ...r,
      content: hidden ? "" : r.content,
      contentTe: hidden ? null : r.contentTe,
      hidden,
      authorName,
      approverName,
      isAuthor: r.authorStaffId === actor.staffId,
    };
  });
}

function reportValues(input: ReportInput, actor: StaffActor) {
  return {
    reportType: input.reportType,
    title: input.title,
    periodStart: nn(input.periodStart),
    periodEnd: nn(input.periodEnd),
    content: input.content,
    contentTe: nn(input.contentTe),
    teTranslationReviewedBy: nn(input.contentTe) && input.teReviewed ? actor.staffId : null,
  };
}

export async function saveReport(tx: Tx, actor: StaffActor, input: ReportInput) {
  const access = await assertChildAccess(tx, actor, input.childId, "canWriteClinical");
  const isPsych = input.reportType === "psychological_report";
  if (isPsych && !actor.roles.includes("psychologist")) throw new AppError("errors.serviceRole");
  if (isPsych && !access.canViewRestricted) throw new ForbiddenError("restricted");
  if (input.id) {
    const [r] = await tx.select().from(reports).where(eq(reports.id, input.id));
    if (!r || r.childId !== input.childId) throw new NotFoundError("report");
    if (r.authorStaffId !== actor.staffId) throw new AppError("errors.notYourRecord");
    if (!["draft", "pending_approval"].includes(r.status)) throw new AppError("errors.recordLocked");
    await tx.update(reports).set({ ...reportValues(input, actor), status: "draft", isRestricted: isPsych || r.isRestricted }).where(eq(reports.id, r.id));
    await audit(tx, actor, { action: "report.updated", entityType: "report", entityId: r.id, childId: r.childId });
    return r.id;
  }
  const [row] = await tx
    .insert(reports)
    .values({ ...reportValues(input, actor), organizationId: actor.orgId, childId: input.childId, authorStaffId: actor.staffId, isRestricted: isPsych })
    .returning({ id: reports.id });
  await audit(tx, actor, { action: "report.created", entityType: "report", entityId: row.id, childId: input.childId, summary: input.title });
  return row.id;
}

export async function transitionReport(tx: Tx, actor: StaffActor, reportId: string, to: "pending_approval" | "approved" | "shared" | "withdrawn") {
  const [r] = await tx.select().from(reports).where(eq(reports.id, reportId));
  if (!r) throw new NotFoundError("report");
  const access = await assertChildAccess(tx, actor, r.childId, "canViewClinical");
  if (r.isRestricted && !access.canViewRestricted && r.authorStaffId !== actor.staffId) throw new ForbiddenError("restricted");
  const isAuthor = r.authorStaffId === actor.staffId;
  const canApprove =
    actor.permissions.includes("reports.approve") &&
    (r.reportType !== "psychological_report" || actor.roles.includes("psychologist") || actor.roles.includes("clinical_coordinator"));
  const allowed: Record<string, () => boolean> = {
    pending_approval: () => isAuthor && r.status === "draft",
    // Four-eyes: authors cannot approve their own reports, except a
    // psychologist approving their own psychological report.
    approved: () => canApprove && r.status === "pending_approval" && (!isAuthor || r.reportType === "psychological_report"),
    shared: () => (canApprove || isAuthor) && r.status === "approved",
    withdrawn: () => (canApprove || isAuthor) && r.status === "shared",
  };
  if (!allowed[to]()) throw new AppError("errors.invalidStatus");
  if (to === "shared") {
    if (!(await hasConsent(tx, r.childId, "parent_portal"))) throw new AppError("communication.shareNeedsConsent");
    if (r.contentTe && !r.teTranslationReviewedBy) throw new AppError("errors.invalidStatus");
  }
  await tx
    .update(reports)
    .set(
      to === "approved"
        ? { status: to, approvedBy: actor.staffId, approvedAt: new Date() }
        : to === "shared"
          ? { status: to, sharedAt: new Date() }
          : { status: to },
    )
    .where(eq(reports.id, reportId));
  await audit(tx, actor, { action: `report.${to}`, entityType: "report", entityId: reportId, childId: r.childId, changes: { status: { from: r.status, to } } });
}

/**
 * Builds a FACTUAL report draft from recorded data only (counts and dates).
 * No interpretation, diagnosis or claim of improvement is generated.
 */
export async function createSummaryDraft(tx: Tx, actor: StaffActor, childId: string, from: string, to: string) {
  await assertChildAccess(tx, actor, childId, "canWriteClinical");
  const [child] = await tx.select().from(children).where(eq(children.id, childId));
  const s = await periodSummary(tx, childId, from, to);
  const services = Object.entries(s.byService).map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`).join("; ") || "none";
  const content = [
    `Progress summary for ${child.preferredName ?? child.fullName} (${child.childCode})`,
    `Period: ${formatDate(from)} – ${formatDate(to)}`,
    "",
    "Recorded attendance",
    `- Sessions attended: ${s.attended}`,
    `- Sessions missed (no-show / cancelled by family): ${s.missed}`,
    `- Sessions cancelled by the center: ${s.cancelledByCenter}`,
    `- Session records by service: ${services}`,
    "",
    "Goals",
    `- Goals worked on in sessions: ${s.goalsWorkedOn}`,
    `- Goal observations recorded: ${s.observations}`,
    "",
    "[Therapist to complete: describe observed progress for each goal, referring to the recorded observations. Do not state improvement unless supported by the recorded data.]",
  ].join("\n");
  return saveReport(tx, actor, {
    childId,
    reportType: "progress_summary",
    title: `Progress summary ${from} – ${to}`,
    periodStart: from,
    periodEnd: to,
    content,
    contentTe: "",
    teReviewed: false,
  });
}
