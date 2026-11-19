/**
 * Developmental assessments. CareOS stores what the professional observed and
 * documented; it never derives a diagnosis or standardized score.
 */
import { and, desc, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { assessmentDomains, assessments, services, staff } from "@/db/schema";
import { canDeliverService } from "@/lib/permissions";
import type { ServiceCode } from "@/lib/constants";
import type { AssessmentInput } from "@/lib/validation/assessments";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { nn } from "../text";

async function validateAuthorship(tx: Tx, actor: StaffActor, input: AssessmentInput) {
  if (input.assessorRole === "admin" || !actor.roles.includes(input.assessorRole)) throw new ForbiddenError("assessor role");
  let restricted = input.isRestricted;
  if (input.serviceId) {
    const [svc] = await tx.select().from(services).where(eq(services.id, input.serviceId));
    if (!svc) throw new NotFoundError("service");
    if (!canDeliverService(actor.roles, svc.code as ServiceCode)) throw new AppError("errors.serviceRole");
    if (svc.code === "psychology") restricted = true; // psychological records are always restricted
  }
  return restricted;
}

function values(input: AssessmentInput) {
  return {
    serviceId: nn(input.serviceId),
    assessorRole: input.assessorRole,
    assessmentDate: input.assessmentDate,
    toolName: input.toolName,
    toolVersion: nn(input.toolVersion),
    reasonForAssessment: nn(input.reasonForAssessment),
    overallObservations: nn(input.overallObservations),
    recommendations: nn(input.recommendations),
    reviewDate: nn(input.reviewDate),
  };
}

async function writeDomains(tx: Tx, orgId: string, assessmentId: string, domains: AssessmentInput["domains"]) {
  await tx.delete(assessmentDomains).where(eq(assessmentDomains.assessmentId, assessmentId));
  const rows = domains
    .filter((d) => d.findings.trim() || d.observations.trim())
    .map((d) => ({ organizationId: orgId, assessmentId, domain: d.domain, findings: nn(d.findings), observations: nn(d.observations) }));
  if (rows.length) await tx.insert(assessmentDomains).values(rows);
}

export async function createAssessment(tx: Tx, actor: StaffActor, input: AssessmentInput) {
  const access = await assertChildAccess(tx, actor, input.childId, "canWriteClinical");
  const restricted = await validateAuthorship(tx, actor, input);
  if (restricted && !access.canViewRestricted) throw new ForbiddenError("restricted");
  const [me] = await tx.select({ q: staff.qualifications }).from(staff).where(eq(staff.id, actor.staffId));
  const [row] = await tx
    .insert(assessments)
    .values({
      ...values(input),
      organizationId: actor.orgId,
      childId: input.childId,
      assessorStaffId: actor.staffId,
      assessorQualifications: me?.q ?? null,
      isRestricted: restricted,
    })
    .returning({ id: assessments.id });
  await writeDomains(tx, actor.orgId, row.id, input.domains);
  await audit(tx, actor, { action: "assessment.created", entityType: "assessment", entityId: row.id, childId: input.childId, summary: input.toolName });
  return row.id;
}

async function loadOwnDraft(tx: Tx, actor: StaffActor, id: string) {
  const [a] = await tx.select().from(assessments).where(eq(assessments.id, id));
  if (!a) throw new NotFoundError("assessment");
  await assertChildAccess(tx, actor, a.childId, "canWriteClinical");
  if (a.assessorStaffId !== actor.staffId) throw new AppError("errors.notYourRecord");
  if (a.status !== "draft") throw new AppError("errors.recordLocked");
  return a;
}

export async function updateAssessment(tx: Tx, actor: StaffActor, id: string, input: AssessmentInput) {
  const a = await loadOwnDraft(tx, actor, id);
  if (a.childId !== input.childId) throw new ForbiddenError("child mismatch");
  const restricted = await validateAuthorship(tx, actor, input);
  await tx.update(assessments).set({ ...values(input), isRestricted: restricted || a.isRestricted }).where(eq(assessments.id, id));
  await writeDomains(tx, actor.orgId, id, input.domains);
  await audit(tx, actor, { action: "assessment.updated", entityType: "assessment", entityId: id, childId: a.childId });
}

export async function finalizeAssessment(tx: Tx, actor: StaffActor, id: string) {
  const a = await loadOwnDraft(tx, actor, id);
  await tx.update(assessments).set({ status: "finalized", finalizedAt: new Date() }).where(eq(assessments.id, id));
  await audit(tx, actor, { action: "assessment.finalized", entityType: "assessment", entityId: id, childId: a.childId });
}

export async function listAssessments(tx: Tx, actor: StaffActor, childId: string) {
  const access = await assertChildAccess(tx, actor, childId, "canViewClinical");
  const rows = await tx
    .select({
      id: assessments.id,
      assessmentDate: assessments.assessmentDate,
      toolName: assessments.toolName,
      status: assessments.status,
      isRestricted: assessments.isRestricted,
      assessorName: staff.fullName,
      assessorRole: assessments.assessorRole,
      serviceCode: services.code,
      reviewDate: assessments.reviewDate,
    })
    .from(assessments)
    .innerJoin(staff, eq(staff.id, assessments.assessorStaffId))
    .leftJoin(services, eq(services.id, assessments.serviceId))
    .where(eq(assessments.childId, childId))
    .orderBy(desc(assessments.assessmentDate));
  // Restricted rows are listed (so staff know they exist) but without content.
  return rows.map((r) => (r.isRestricted && !access.canViewRestricted ? { ...r, toolName: null, hidden: true } : { ...r, hidden: false }));
}

export async function getAssessment(tx: Tx, actor: StaffActor, id: string) {
  const [a] = await tx
    .select({ a: assessments, assessorName: staff.fullName, serviceCode: services.code })
    .from(assessments)
    .innerJoin(staff, eq(staff.id, assessments.assessorStaffId))
    .leftJoin(services, eq(services.id, assessments.serviceId))
    .where(eq(assessments.id, id));
  if (!a) throw new NotFoundError("assessment");
  const access = await assertChildAccess(tx, actor, a.a.childId, "canViewClinical");
  if (a.a.isRestricted && !access.canViewRestricted) throw new ForbiddenError("restricted");
  const domains = await tx.select().from(assessmentDomains).where(and(eq(assessmentDomains.assessmentId, id)));
  if (a.a.isRestricted) {
    await audit(tx, actor, { action: "assessment.viewed_restricted", entityType: "assessment", entityId: id, childId: a.a.childId });
  }
  return {
    ...a.a,
    assessorName: a.assessorName,
    serviceCode: a.serviceCode,
    domains,
    canEdit: a.a.assessorStaffId === actor.staffId && a.a.status === "draft",
  };
}
