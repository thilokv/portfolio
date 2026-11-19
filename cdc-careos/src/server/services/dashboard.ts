/** Dashboard figures — every number is a live database count. */
import { and, asc, between, desc, eq, gte, inArray, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  appointments,
  auditLogs,
  children,
  developmentGoals,
  developmentPlans,
  services,
  staff,
  staffAvailability,
  staffRoles,
  therapySessions,
} from "@/db/schema";
import { addDays, isoDateIST, istDayBounds, startOfWeek } from "@/lib/dates";
import type { StaffActor } from "../auth/actor";
import { visibleChildIds } from "../authz";

export async function getDashboard(tx: Tx, actor: StaffActor) {
  const today = isoDateIST();
  const { start, end } = istDayBounds(today);
  const visible = await visibleChildIds(tx, actor);
  const all = visible === null;
  const childScope = (col: typeof children.id | typeof appointments.childId): SQL | undefined =>
    all ? undefined : visible.length ? inArray(col, visible) : sql`false`;

  const [{ total }] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(children)
    .where(and(ne(children.status, "archived"), childScope(children.id)));
  const [{ active }] = await tx
    .select({ active: sql<number>`count(*)::int` })
    .from(children)
    .where(and(eq(children.status, "active"), childScope(children.id)));

  const apptScope = all ? undefined : eq(appointments.staffId, actor.staffId);
  const [{ todayAppts }] = await tx
    .select({ todayAppts: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end), ne(appointments.status, "cancelled"), apptScope));

  const sessionScope = all ? undefined : eq(therapySessions.therapistStaffId, actor.staffId);
  const [{ completedToday }] = await tx
    .select({ completedToday: sql<number>`count(*)::int` })
    .from(therapySessions)
    .where(and(eq(therapySessions.sessionDate, today), inArray(therapySessions.status, ["completed", "signed"]), sessionScope));

  const pendingNotes = await tx
    .select({
      id: therapySessions.id,
      sessionDate: therapySessions.sessionDate,
      status: therapySessions.status,
      childName: children.fullName,
      childCode: children.childCode,
      serviceCode: services.code,
      therapist: staff.fullName,
    })
    .from(therapySessions)
    .innerJoin(children, eq(children.id, therapySessions.childId))
    .innerJoin(services, eq(services.id, therapySessions.serviceId))
    .innerJoin(staff, eq(staff.id, therapySessions.therapistStaffId))
    .where(and(inArray(therapySessions.status, ["in_progress", "completed"]), sessionScope))
    .orderBy(asc(therapySessions.sessionDate));

  const in30 = addDays(today, 30);
  const goalReviews = await tx
    .select({
      kind: sql<string>`'goal'`,
      id: developmentGoals.id,
      title: developmentGoals.title,
      reviewDate: developmentGoals.reviewDate,
      childId: children.id,
      childName: children.fullName,
    })
    .from(developmentGoals)
    .innerJoin(children, eq(children.id, developmentGoals.childId))
    .where(
      and(
        eq(developmentGoals.isCurrent, true),
        notInArray(developmentGoals.status, ["achieved", "discontinued"]),
        between(developmentGoals.reviewDate, today, in30),
        ne(children.status, "archived"),
        childScope(children.id),
      ),
    );
  const planReviews = await tx
    .select({
      kind: sql<string>`'plan'`,
      id: developmentPlans.id,
      title: developmentPlans.title,
      reviewDate: developmentPlans.reviewDate,
      childId: children.id,
      childName: children.fullName,
    })
    .from(developmentPlans)
    .innerJoin(children, eq(children.id, developmentPlans.childId))
    .where(
      and(
        inArray(developmentPlans.status, ["active", "under_review"]),
        between(developmentPlans.reviewDate, today, in30),
        ne(children.status, "archived"),
        childScope(children.id),
      ),
    );
  const reviews = [...goalReviews, ...planReviews].sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));

  // Staff availability today (clinical staff).
  const clinicians = await tx
    .selectDistinct({ id: staff.id, name: staff.fullName })
    .from(staff)
    .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
    .where(and(eq(staff.isActive, true), ne(staffRoles.role, "admin")))
    .orderBy(asc(staff.fullName));
  const leave = await tx
    .select({ staffId: staffAvailability.staffId, status: staffAvailability.status })
    .from(staffAvailability)
    .where(eq(staffAvailability.date, today));
  const counts = await tx
    .select({ staffId: appointments.staffId, n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end), ne(appointments.status, "cancelled")))
    .groupBy(appointments.staffId);
  const availability = clinicians.map((c) => ({
    ...c,
    status: leave.find((l) => l.staffId === c.id)?.status ?? null,
    appointments: counts.find((x) => x.staffId === c.id)?.n ?? 0,
  }));

  // My schedule today.
  const myDay = await tx
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      room: appointments.room,
      childId: children.id,
      childName: children.fullName,
      childCode: children.childCode,
      serviceCode: services.code,
      sessionId: therapySessions.id,
    })
    .from(appointments)
    .innerJoin(children, eq(children.id, appointments.childId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(therapySessions, eq(therapySessions.appointmentId, appointments.id))
    .where(and(eq(appointments.staffId, actor.staffId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
    .orderBy(asc(appointments.startsAt));

  // Recent activity: all for auditors, otherwise own actions + own children.
  const activityScope = actor.permissions.includes("audit.view")
    ? undefined
    : or(eq(auditLogs.actorUserId, actor.userId), visible && visible.length ? inArray(auditLogs.childId, visible) : sql`false`);
  const activity = await tx
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorName: auditLogs.actorName,
      summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
      childId: auditLogs.childId,
    })
    .from(auditLogs)
    .where(and(activityScope, sql`${auditLogs.action} not like 'auth.%'`))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);

  // This week's appointments by day and status (scoped like today's count).
  const weekStart = startOfWeek(today);
  const wkStart = istDayBounds(weekStart).start;
  const wkEnd = istDayBounds(addDays(weekStart, 7)).start;
  const weekRows = await tx
    .select({
      day: sql<string>`to_char(${appointments.startsAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
      status: appointments.status,
      n: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(and(gte(appointments.startsAt, wkStart), lt(appointments.startsAt, wkEnd), apptScope))
    .groupBy(sql`1`, appointments.status);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const rows = weekRows.filter((r) => r.day === day);
    const get = (s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
    return { day, completed: get(["completed"]), missed: get(["no_show", "cancelled"]), upcoming: get(["scheduled", "checked_in", "in_progress"]) };
  });

  return {
    scopeAll: all,
    totals: { total, active, todayAppts, completedToday, pendingNotes: pendingNotes.length, reviews: reviews.length },
    pendingNotes: pendingNotes.slice(0, 6),
    reviews: reviews.slice(0, 6),
    availability,
    myDay,
    activity,
    week,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
