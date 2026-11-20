/**
 * Appointment scheduling and therapy sessions.
 *
 * Rules enforced here (and partly by the database):
 * - Only active children with therapy consent can be scheduled.
 * - The therapist must be on the child's care team and hold a role that
 *   delivers the service; unavailable therapists cannot be booked.
 * - Overlapping bookings are rejected by exclusion constraints.
 * - Only the assigned therapist can start, document, complete or sign a
 *   session. Signed sessions are locked by a database trigger.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  appointments,
  childAssignments,
  children,
  developmentGoals,
  goalObservations,
  services,
  sessionGoals,
  sessionObservations,
  staff,
  staffAvailability,
  staffRoles,
  therapySessions,
} from "@/db/schema";
import { canDeliverService } from "@/lib/permissions";
import { WORKFLOW_FIELDS, type ServiceCode, type StaffRole } from "@/lib/constants";
import { addDays, fromLocalDateTime, isoDateIST, istDayBounds } from "@/lib/dates";
import type { AppointmentInput, SessionNoteInput } from "@/lib/validation/scheduling";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess, visibleChildIds } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { hasConsent } from "./children";
import { intOrNull, nn } from "../text";

/* ----------------------------------------------------------- scheduling */

export async function createAppointments(tx: Tx, actor: StaffActor, input: AppointmentInput) {
  const manageAll = actor.permissions.includes("appointments.manage_all");
  if (!manageAll) {
    if (!actor.permissions.includes("appointments.manage_own") || input.staffId !== actor.staffId) {
      throw new ForbiddenError("appointments");
    }
  }
  await assertChildAccess(tx, actor, input.childId);
  const [child] = await tx.select().from(children).where(eq(children.id, input.childId));
  if (child.status !== "active") throw new AppError("errors.childInactive");
  if (!(await hasConsent(tx, input.childId, "therapy_services"))) throw new AppError("errors.consentRequired");

  const [svc] = await tx.select().from(services).where(eq(services.id, input.serviceId));
  if (!svc || !svc.isActive) throw new NotFoundError("service");
  const [therapist] = await tx.select().from(staff).where(eq(staff.id, input.staffId));
  if (!therapist || !therapist.isActive) throw new NotFoundError("staff");
  const roles = (await tx.select({ role: staffRoles.role }).from(staffRoles).where(eq(staffRoles.staffId, input.staffId))).map((r) => r.role as StaffRole);
  if (!canDeliverService(roles, svc.code as ServiceCode)) throw new AppError("errors.serviceRole");
  const [onTeam] = await tx
    .select({ id: childAssignments.id })
    .from(childAssignments)
    .where(and(eq(childAssignments.childId, input.childId), eq(childAssignments.staffId, input.staffId), isNull(childAssignments.endedAt)));
  if (!onTeam) throw new AppError("errors.assigneeNotOnTeam");

  const minutes = Number(input.durationMinutes);
  const weeks = Number(input.repeatWeeks);
  const created: string[] = [];
  for (let w = 0; w <= weeks; w++) {
    const localDate = addDays(input.start.slice(0, 10), w * 7);
    const startsAt = fromLocalDateTime(`${localDate}T${input.start.slice(11)}`);
    const [unavailable] = await tx
      .select({ id: staffAvailability.id })
      .from(staffAvailability)
      .where(and(eq(staffAvailability.staffId, input.staffId), eq(staffAvailability.date, localDate), ne(staffAvailability.status, "half_day")));
    if (unavailable) throw new AppError("errors.staffUnavailable");
    const [row] = await tx
      .insert(appointments)
      .values({
        organizationId: actor.orgId,
        childId: input.childId,
        serviceId: input.serviceId,
        staffId: input.staffId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + minutes * 60_000),
        room: nn(input.room),
        adminNotes: nn(input.adminNotes),
        createdBy: actor.staffId,
      })
      .returning({ id: appointments.id });
    created.push(row.id);
  }
  await audit(tx, actor, {
    action: "appointment.created",
    entityType: "appointment",
    entityId: created[0],
    childId: input.childId,
    summary: `${svc.code} with ${therapist.fullName}${weeks ? ` (+${weeks} weekly)` : ""}`,
  });
  return created;
}

async function loadAppointment(tx: Tx, actor: StaffActor, id: string) {
  const [a] = await tx.select().from(appointments).where(eq(appointments.id, id));
  if (!a) throw new NotFoundError("appointment");
  const manageAll = actor.permissions.includes("appointments.manage_all");
  if (!manageAll && a.staffId !== actor.staffId) throw new ForbiddenError("appointment");
  return a;
}

export async function checkInAppointment(tx: Tx, actor: StaffActor, id: string) {
  const a = await loadAppointment(tx, actor, id);
  if (a.status !== "scheduled") throw new AppError("errors.invalidStatus");
  const late = Date.now() > a.startsAt.getTime() + 10 * 60_000;
  await tx.update(appointments).set({ status: "checked_in", attendance: late ? "late" : "present" }).where(eq(appointments.id, id));
  await audit(tx, actor, { action: "appointment.checked_in", entityType: "appointment", entityId: id, childId: a.childId });
}

export async function cancelAppointment(tx: Tx, actor: StaffActor, id: string, reason: string, by: "cancelled_by_family" | "cancelled_by_center") {
  const a = await loadAppointment(tx, actor, id);
  if (!["scheduled", "checked_in"].includes(a.status)) throw new AppError("errors.invalidStatus");
  await tx.update(appointments).set({ status: "cancelled", attendance: by, cancellationReason: reason }).where(eq(appointments.id, id));
  await audit(tx, actor, { action: "appointment.cancelled", entityType: "appointment", entityId: id, childId: a.childId, summary: reason });
}

export async function markNoShow(tx: Tx, actor: StaffActor, id: string) {
  const a = await loadAppointment(tx, actor, id);
  if (!["scheduled", "checked_in"].includes(a.status)) throw new AppError("errors.invalidStatus");
  await tx.update(appointments).set({ status: "no_show", attendance: "absent" }).where(eq(appointments.id, id));
  await audit(tx, actor, { action: "appointment.no_show", entityType: "appointment", entityId: id, childId: a.childId });
}

export async function listDay(tx: Tx, actor: StaffActor, isoDate: string, opts: { staffId?: string; mine?: boolean }) {
  const { start, end } = istDayBounds(isoDate);
  const manageAll = actor.permissions.includes("appointments.manage_all");
  const staffFilter = !manageAll || opts.mine ? actor.staffId : opts.staffId;
  return tx
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      attendance: appointments.attendance,
      room: appointments.room,
      cancellationReason: appointments.cancellationReason,
      childId: children.id,
      childName: children.fullName,
      childCode: children.childCode,
      serviceCode: services.code,
      staffId: staff.id,
      staffName: staff.fullName,
      sessionId: therapySessions.id,
      sessionStatus: therapySessions.status,
    })
    .from(appointments)
    .innerJoin(children, eq(children.id, appointments.childId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .leftJoin(therapySessions, eq(therapySessions.appointmentId, appointments.id))
    .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end), staffFilter ? eq(appointments.staffId, staffFilter) : undefined))
    .orderBy(asc(appointments.startsAt), asc(staff.fullName));
}

/** Children (with care teams) the actor may schedule for. */
export async function schedulingOptions(tx: Tx, actor: StaffActor) {
  const visible = await visibleChildIds(tx, actor);
  const kids = await tx
    .select({ id: children.id, fullName: children.fullName, childCode: children.childCode })
    .from(children)
    .where(and(eq(children.status, "active"), visible ? (visible.length ? inArray(children.id, visible) : sql`false`) : undefined))
    .orderBy(asc(children.fullName));
  const team = await tx
    .select({ childId: childAssignments.childId, staffId: staff.id, staffName: staff.fullName, serviceId: childAssignments.serviceId })
    .from(childAssignments)
    .innerJoin(staff, eq(staff.id, childAssignments.staffId))
    .where(and(isNull(childAssignments.endedAt), eq(staff.isActive, true)));
  const roleRows = await tx.select({ staffId: staffRoles.staffId, role: staffRoles.role }).from(staffRoles);
  const svc = await tx.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.name));
  return {
    children: kids.map((k) => ({
      ...k,
      team: team
        .filter((t) => t.childId === k.id)
        .map((t) => ({ staffId: t.staffId, staffName: t.staffName, serviceId: t.serviceId, roles: roleRows.filter((r) => r.staffId === t.staffId).map((r) => r.role) })),
    })),
    services: svc.map((s) => ({ id: s.id, code: s.code, duration: s.defaultDurationMinutes })),
  };
}

/* ------------------------------------------------------------- sessions */

export async function startSession(tx: Tx, actor: StaffActor, appointmentId: string) {
  const [a] = await tx.select().from(appointments).where(eq(appointments.id, appointmentId));
  if (!a) throw new NotFoundError("appointment");
  if (a.staffId !== actor.staffId) throw new AppError("errors.notYourRecord");
  await assertChildAccess(tx, actor, a.childId, "canWriteClinical");
  const [existing] = await tx.select({ id: therapySessions.id }).from(therapySessions).where(eq(therapySessions.appointmentId, appointmentId));
  if (existing) return existing.id;
  if (!["scheduled", "checked_in"].includes(a.status)) throw new AppError("errors.invalidStatus");
  const [s] = await tx
    .insert(therapySessions)
    .values({
      organizationId: actor.orgId,
      appointmentId,
      childId: a.childId,
      serviceId: a.serviceId,
      therapistStaffId: actor.staffId,
      sessionDate: isoDateIST(a.startsAt),
      attendance: a.attendance === "late" ? "late" : "present",
    })
    .returning({ id: therapySessions.id });
  await tx.update(appointments).set({ status: "in_progress", attendance: a.attendance ?? "present" }).where(eq(appointments.id, appointmentId));
  await audit(tx, actor, { action: "session.started", entityType: "therapy_session", entityId: s.id, childId: a.childId });
  return s.id;
}

async function loadOwnOpenSession(tx: Tx, actor: StaffActor, sessionId: string) {
  const [s] = await tx.select().from(therapySessions).where(eq(therapySessions.id, sessionId));
  if (!s) throw new NotFoundError("session");
  await assertChildAccess(tx, actor, s.childId, "canViewClinical");
  if (s.therapistStaffId !== actor.staffId) throw new AppError("errors.notYourRecord");
  if (s.status === "signed") throw new AppError("errors.recordLocked");
  return s;
}

function cleanWorkflow(serviceCode: ServiceCode, data: Record<string, string>) {
  const allowed = new Set(WORKFLOW_FIELDS[serviceCode].map((f) => f.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (allowed.has(k) && v.trim()) out[k] = v.trim();
  return out;
}

export async function saveSessionNote(tx: Tx, actor: StaffActor, input: SessionNoteInput) {
  const s = await loadOwnOpenSession(tx, actor, input.sessionId);
  const [svc] = await tx.select({ code: services.code }).from(services).where(eq(services.id, s.serviceId));
  await tx
    .update(therapySessions)
    .set({
      attendance: input.attendance,
      activitiesCompleted: nn(input.activitiesCompleted),
      childResponse: nn(input.childResponse),
      overallAssistance: input.overallAssistance || null,
      followUp: nn(input.followUp),
      parentParticipation: nn(input.parentParticipation),
      homeActivitySuggestion: nn(input.homeActivitySuggestion),
      workflowData: cleanWorkflow(svc.code as ServiceCode, input.workflow),
    })
    .where(eq(therapySessions.id, s.id));

  // Goals addressed + goal-level measurements (replaced on each save while unsigned).
  const goalIds = input.goals.filter((g) => g.addressed).map((g) => g.goalId);
  if (goalIds.length) {
    const valid = await tx
      .select({ id: developmentGoals.id })
      .from(developmentGoals)
      .where(and(inArray(developmentGoals.id, goalIds), eq(developmentGoals.childId, s.childId), eq(developmentGoals.isCurrent, true)));
    if (valid.length !== new Set(goalIds).size) throw new ForbiddenError("goal not for this child");
  }
  await tx.delete(sessionGoals).where(eq(sessionGoals.sessionId, s.id));
  await tx.delete(goalObservations).where(eq(goalObservations.sessionId, s.id));
  for (const g of input.goals.filter((x) => x.addressed)) {
    await tx.insert(sessionGoals).values({ organizationId: actor.orgId, sessionId: s.id, goalId: g.goalId, note: nn(g.note) });
    const hasMeasure = g.trialsTotal.trim() !== "" || g.assistanceLevel !== "" || g.note.trim() !== "";
    if (hasMeasure) {
      await tx.insert(goalObservations).values({
        organizationId: actor.orgId,
        goalId: g.goalId,
        childId: s.childId,
        sessionId: s.id,
        observedOn: s.sessionDate,
        observedBy: actor.staffId,
        trialsTotal: intOrNull(g.trialsTotal),
        trialsSuccessful: intOrNull(g.trialsSuccessful),
        independentTrials: intOrNull(g.independentTrials),
        assistanceLevel: g.assistanceLevel || null,
        note: nn(g.note),
      });
    }
  }
  await audit(tx, actor, { action: "session.note_saved", entityType: "therapy_session", entityId: s.id, childId: s.childId });
}

export async function addSessionObservation(tx: Tx, actor: StaffActor, sessionId: string, category: string, observation: string) {
  const s = await loadOwnOpenSession(tx, actor, sessionId);
  await tx.insert(sessionObservations).values({ organizationId: actor.orgId, sessionId, category, observation, recordedBy: actor.staffId });
  await audit(tx, actor, { action: "session.observation_added", entityType: "therapy_session", entityId: s.id, childId: s.childId });
}

export async function completeSession(tx: Tx, actor: StaffActor, sessionId: string) {
  const s = await loadOwnOpenSession(tx, actor, sessionId);
  if (s.status !== "in_progress") throw new AppError("errors.invalidStatus");
  await tx.update(therapySessions).set({ status: "completed", endedAt: new Date() }).where(eq(therapySessions.id, s.id));
  if (s.appointmentId) {
    const absent = s.attendance === "absent" || s.attendance.startsWith("cancelled");
    await tx
      .update(appointments)
      .set({ status: absent ? "no_show" : "completed", attendance: s.attendance })
      .where(eq(appointments.id, s.appointmentId));
  }
  await audit(tx, actor, { action: "session.completed", entityType: "therapy_session", entityId: s.id, childId: s.childId });
}

export async function signSession(tx: Tx, actor: StaffActor, sessionId: string) {
  const s = await loadOwnOpenSession(tx, actor, sessionId);
  if (s.status !== "completed") throw new AppError("errors.invalidStatus");
  await tx.update(therapySessions).set({ status: "signed", signedAt: new Date() }).where(eq(therapySessions.id, s.id));
  await audit(tx, actor, { action: "session.signed", entityType: "therapy_session", entityId: s.id, childId: s.childId });
}

export async function getSession(tx: Tx, actor: StaffActor, sessionId: string) {
  const [row] = await tx
    .select({ s: therapySessions, childName: children.fullName, childCode: children.childCode, serviceCode: services.code, therapistName: staff.fullName })
    .from(therapySessions)
    .innerJoin(children, eq(children.id, therapySessions.childId))
    .innerJoin(services, eq(services.id, therapySessions.serviceId))
    .innerJoin(staff, eq(staff.id, therapySessions.therapistStaffId))
    .where(eq(therapySessions.id, sessionId));
  if (!row) throw new NotFoundError("session");
  const access = await assertChildAccess(tx, actor, row.s.childId, "canViewClinical");
  // Psychology session notes are restricted records.
  if (row.serviceCode === "psychology" && !access.canViewRestricted && row.s.therapistStaffId !== actor.staffId) {
    throw new ForbiddenError("restricted");
  }
  const goals = await tx
    .select({ id: developmentGoals.id, title: developmentGoals.title, domain: developmentGoals.domain, target: developmentGoals.target, serviceId: developmentGoals.serviceId })
    .from(developmentGoals)
    .where(
      and(
        eq(developmentGoals.childId, row.s.childId),
        or(
          and(eq(developmentGoals.isCurrent, true), sql`${developmentGoals.status} not in ('achieved','discontinued')`),
          inArray(developmentGoals.id, tx.select({ id: sessionGoals.goalId }).from(sessionGoals).where(eq(sessionGoals.sessionId, sessionId))),
        ),
      ),
    )
    .orderBy(asc(developmentGoals.createdAt));
  const addressed = await tx.select().from(sessionGoals).where(eq(sessionGoals.sessionId, sessionId));
  const observations = await tx.select().from(goalObservations).where(eq(goalObservations.sessionId, sessionId));
  const notes = await tx
    .select({ id: sessionObservations.id, category: sessionObservations.category, observation: sessionObservations.observation, createdAt: sessionObservations.createdAt, by: staff.fullName })
    .from(sessionObservations)
    .innerJoin(staff, eq(staff.id, sessionObservations.recordedBy))
    .where(eq(sessionObservations.sessionId, sessionId))
    .orderBy(asc(sessionObservations.createdAt));
  return {
    ...row.s,
    childName: row.childName,
    childCode: row.childCode,
    serviceCode: row.serviceCode as ServiceCode,
    therapistName: row.therapistName,
    goals,
    addressed,
    observations,
    notes,
    canEdit: row.s.therapistStaffId === actor.staffId && row.s.status !== "signed",
  };
}

export async function listSessions(tx: Tx, actor: StaffActor, opts: { childId?: string; pendingOnly?: boolean; mine?: boolean }) {
  let childFilter;
  if (opts.childId) {
    await assertChildAccess(tx, actor, opts.childId, "canViewClinical");
    childFilter = eq(therapySessions.childId, opts.childId);
  } else {
    const visible = await visibleChildIds(tx, actor);
    childFilter = visible ? (visible.length ? inArray(therapySessions.childId, visible) : sql`false`) : undefined;
  }
  return tx
    .select({
      id: therapySessions.id,
      sessionDate: therapySessions.sessionDate,
      status: therapySessions.status,
      attendance: therapySessions.attendance,
      childId: children.id,
      childName: children.fullName,
      childCode: children.childCode,
      serviceCode: services.code,
      therapistName: staff.fullName,
      therapistStaffId: therapySessions.therapistStaffId,
    })
    .from(therapySessions)
    .innerJoin(children, eq(children.id, therapySessions.childId))
    .innerJoin(services, eq(services.id, therapySessions.serviceId))
    .innerJoin(staff, eq(staff.id, therapySessions.therapistStaffId))
    .where(
      and(
        childFilter,
        opts.mine ? eq(therapySessions.therapistStaffId, actor.staffId) : undefined,
        opts.pendingOnly ? inArray(therapySessions.status, ["in_progress", "completed"]) : undefined,
      ),
    )
    .orderBy(desc(therapySessions.sessionDate), desc(therapySessions.startedAt))
    .limit(200);
}
