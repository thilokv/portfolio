/** Goal progress & period summaries — derived only from recorded data. */
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { appointments, developmentGoals, goalObservations, services, sessionGoals, staff, therapySessions } from "@/db/schema";
import { describeTrend, chartPoints } from "@/lib/progress";
import { istDayBounds, addDays } from "@/lib/dates";
import type { ObservationInput } from "@/lib/validation/progress";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess } from "../authz";
import { AppError, NotFoundError } from "../errors";
import { intOrNull, nn } from "../text";

export async function getGoalProgress(tx: Tx, actor: StaffActor, childId: string) {
  await assertChildAccess(tx, actor, childId, "canViewClinical");
  const goals = await tx
    .select({ g: developmentGoals, responsibleName: staff.fullName, serviceCode: services.code })
    .from(developmentGoals)
    .innerJoin(staff, eq(staff.id, developmentGoals.responsibleStaffId))
    .leftJoin(services, eq(services.id, developmentGoals.serviceId))
    .where(and(eq(developmentGoals.childId, childId), eq(developmentGoals.isCurrent, true)))
    .orderBy(asc(developmentGoals.createdAt));
  if (goals.length === 0) return [];
  const groupIds = goals.map((g) => g.g.goalGroupId);
  const obs = await tx
    .select({ o: goalObservations, groupId: developmentGoals.goalGroupId, version: developmentGoals.version, observer: staff.fullName })
    .from(goalObservations)
    .innerJoin(developmentGoals, eq(developmentGoals.id, goalObservations.goalId))
    .innerJoin(staff, eq(staff.id, goalObservations.observedBy))
    .where(inArray(developmentGoals.goalGroupId, groupIds))
    .orderBy(asc(goalObservations.observedOn), asc(goalObservations.createdAt));
  return goals.map(({ g, responsibleName, serviceCode }) => {
    const list = obs.filter((x) => x.groupId === g.goalGroupId).map((x) => ({ ...x.o, version: x.version, observer: x.observer }));
    return {
      ...g,
      responsibleName,
      serviceCode,
      observations: list,
      points: chartPoints(list),
      trend: describeTrend(list),
      measuredCount: list.filter((o) => o.trialsTotal != null).length,
      canRecord: g.status !== "discontinued",
    };
  });
}

export async function recordObservation(tx: Tx, actor: StaffActor, input: ObservationInput) {
  const [goal] = await tx.select().from(developmentGoals).where(eq(developmentGoals.id, input.goalId));
  if (!goal) throw new NotFoundError("goal");
  await assertChildAccess(tx, actor, goal.childId, "canWriteClinical");
  if (!goal.isCurrent) throw new AppError("errors.recordLocked");
  const [row] = await tx
    .insert(goalObservations)
    .values({
      organizationId: actor.orgId,
      goalId: goal.id,
      childId: goal.childId,
      observedOn: input.observedOn,
      observedBy: actor.staffId,
      trialsTotal: intOrNull(input.trialsTotal),
      trialsSuccessful: intOrNull(input.trialsSuccessful),
      independentTrials: intOrNull(input.independentTrials),
      assistanceLevel: input.assistanceLevel || null,
      note: nn(input.note),
    })
    .returning({ id: goalObservations.id });
  await audit(tx, actor, { action: "observation.recorded", entityType: "goal_observation", entityId: row.id, childId: goal.childId });
}

/** Attendance & activity summary for a child over [from, to] (inclusive dates). */
export async function periodSummary(tx: Tx, childId: string, from: string, to: string) {
  const start = istDayBounds(from).start;
  const end = istDayBounds(addDays(to, 1)).start;
  const appts = await tx
    .select({ status: appointments.status, attendance: appointments.attendance, n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.childId, childId), gte(appointments.startsAt, start), sql`${appointments.startsAt} < ${end}`))
    .groupBy(appointments.status, appointments.attendance);
  const count = (pred: (r: (typeof appts)[number]) => boolean) => appts.filter(pred).reduce((a, r) => a + r.n, 0);
  const sessions = await tx
    .select({ id: therapySessions.id, serviceCode: services.code })
    .from(therapySessions)
    .innerJoin(services, eq(services.id, therapySessions.serviceId))
    .where(and(eq(therapySessions.childId, childId), gte(therapySessions.sessionDate, from), lte(therapySessions.sessionDate, to)));
  const sessionIds = sessions.map((s) => s.id);
  const goalsWorked = sessionIds.length
    ? await tx.selectDistinct({ goalId: sessionGoals.goalId }).from(sessionGoals).where(inArray(sessionGoals.sessionId, sessionIds))
    : [];
  const [{ obsCount }] = await tx
    .select({ obsCount: sql<number>`count(*)::int` })
    .from(goalObservations)
    .where(and(eq(goalObservations.childId, childId), gte(goalObservations.observedOn, from), lte(goalObservations.observedOn, to)));
  const byService: Record<string, number> = {};
  for (const s of sessions) byService[s.serviceCode] = (byService[s.serviceCode] ?? 0) + 1;
  return {
    from,
    to,
    attended: count((r) => r.status === "completed"),
    missed: count((r) => r.status === "no_show" || (r.status === "cancelled" && r.attendance === "cancelled_by_family")),
    cancelledByCenter: count((r) => r.status === "cancelled" && r.attendance === "cancelled_by_center"),
    scheduled: count((r) => ["scheduled", "checked_in", "in_progress"].includes(r.status)),
    sessions: sessions.length,
    byService,
    goalsWorkedOn: goalsWorked.length,
    observations: obsCount,
  };
}
