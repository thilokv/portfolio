import { and, asc, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { appointments, developmentGoals, services, staff, therapySessions } from "@/db/schema";
import type { ChildAccess } from "@/lib/permissions";

export async function getChildOverview(tx: Tx, childId: string, access: ChildAccess) {
  const [nextAppt] = await tx
    .select({ startsAt: appointments.startsAt, serviceCode: services.code, staffName: staff.fullName, room: appointments.room })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(eq(appointments.childId, childId), gte(appointments.startsAt, new Date()), ne(appointments.status, "cancelled")))
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  if (!access.canViewClinical) return { nextAppt, activeGoals: null, lastSession: null };
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(developmentGoals)
    .where(and(eq(developmentGoals.childId, childId), eq(developmentGoals.isCurrent, true), sql`${developmentGoals.status} not in ('achieved','discontinued')`));
  const [lastSession] = await tx
    .select({ id: therapySessions.id, sessionDate: therapySessions.sessionDate, serviceCode: services.code, therapist: staff.fullName, status: therapySessions.status })
    .from(therapySessions)
    .innerJoin(services, eq(services.id, therapySessions.serviceId))
    .innerJoin(staff, eq(staff.id, therapySessions.therapistStaffId))
    .where(eq(therapySessions.childId, childId))
    .orderBy(desc(therapySessions.sessionDate), desc(therapySessions.startedAt))
    .limit(1);
  return { nextAppt, activeGoals: n, lastSession };
}
