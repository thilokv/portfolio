/** Operational & attendance reporting for a month. All figures are counts. */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { appointments, children, services, staff, therapySessions } from "@/db/schema";
import { addDays, endOfMonth, istDayBounds } from "@/lib/dates";
import type { StaffActor } from "../auth/actor";

export function attendanceRate(r: { completed: number; noShow: number; cancelledFamily: number }): number | null {
  const denom = r.completed + r.noShow + r.cancelledFamily;
  return denom === 0 ? null : Math.round((r.completed / denom) * 100);
}

export async function monthlyOperations(tx: Tx, actor: StaffActor, monthStart: string) {
  const start = istDayBounds(monthStart).start;
  const end = istDayBounds(addDays(endOfMonth(monthStart), 1)).start;
  const all = actor.permissions.includes("reports.operational");
  const scope = all ? undefined : eq(appointments.staffId, actor.staffId);
  const agg = {
    scheduled: sql<number>`count(*)::int`,
    completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
    noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
    cancelledFamily: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled' and ${appointments.attendance} = 'cancelled_by_family')::int`,
    cancelledCenter: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled' and ${appointments.attendance} = 'cancelled_by_center')::int`,
  };
  const where = and(gte(appointments.startsAt, start), lt(appointments.startsAt, end), scope);
  const byService = await tx.select({ key: services.code, ...agg }).from(appointments).innerJoin(services, eq(services.id, appointments.serviceId)).where(where).groupBy(services.code);
  const byTherapist = await tx.select({ key: staff.fullName, ...agg }).from(appointments).innerJoin(staff, eq(staff.id, appointments.staffId)).where(where).groupBy(staff.fullName);
  const [totals] = await tx.select(agg).from(appointments).where(where);
  const [notes] = await tx
    .select({
      signed: sql<number>`count(*) filter (where ${therapySessions.status} = 'signed')::int`,
      pending: sql<number>`count(*) filter (where ${therapySessions.status} <> 'signed')::int`,
    })
    .from(therapySessions)
    .where(and(gte(therapySessions.sessionDate, monthStart), sql`${therapySessions.sessionDate} <= ${endOfMonth(monthStart)}`, all ? undefined : eq(therapySessions.therapistStaffId, actor.staffId)));
  const [kids] = all
    ? await tx
        .select({
          active: sql<number>`count(*) filter (where ${children.status} = 'active')::int`,
          newThisMonth: sql<number>`count(*) filter (where ${children.registrationDate} >= ${monthStart} and ${children.registrationDate} <= ${endOfMonth(monthStart)})::int`,
          waitlisted: sql<number>`count(*) filter (where ${children.status} = 'waitlisted')::int`,
        })
        .from(children)
    : [null];
  return { all, totals, byService, byTherapist, notes, kids };
}
