/**
 * CSV exports for administrators. Restricted (psychological) content and
 * free-text clinical notes are NOT included; exports are audit-logged.
 */
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "@/db";
import { appointments, children, consents, developmentGoals, services, staff, staffRoles, therapySessions, userAccounts } from "@/db/schema";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { ForbiddenError } from "../errors";

export const DATASETS = ["children", "appointments", "sessions", "goals", "consents", "staff"] as const;
export type Dataset = (typeof DATASETS)[number];

/** RFC 4180 CSV with formula-injection protection for spreadsheet apps. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
}

export async function exportDataset(tx: Tx, actor: StaffActor, dataset: Dataset) {
  if (!actor.permissions.includes("data.export")) throw new ForbiddenError("data.export");
  let rows: Record<string, unknown>[] = [];
  switch (dataset) {
    case "children":
      rows = await tx
        .select({ child_code: children.childCode, full_name: children.fullName, date_of_birth: children.dateOfBirth, status: children.status, preferred_language: children.preferredLanguage, registration_date: children.registrationDate })
        .from(children)
        .orderBy(asc(children.childCode));
      break;
    case "appointments":
      rows = await tx
        .select({ starts_at: appointments.startsAt, ends_at: appointments.endsAt, child_code: children.childCode, service: services.code, therapist: staff.fullName, status: appointments.status, attendance: appointments.attendance })
        .from(appointments)
        .innerJoin(children, eq(children.id, appointments.childId))
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .orderBy(asc(appointments.startsAt));
      break;
    case "sessions":
      rows = await tx
        .select({ session_date: therapySessions.sessionDate, child_code: children.childCode, service: services.code, therapist: staff.fullName, status: therapySessions.status, attendance: therapySessions.attendance })
        .from(therapySessions)
        .innerJoin(children, eq(children.id, therapySessions.childId))
        .innerJoin(services, eq(services.id, therapySessions.serviceId))
        .innerJoin(staff, eq(staff.id, therapySessions.therapistStaffId))
        .orderBy(asc(therapySessions.sessionDate));
      break;
    case "goals":
      rows = await tx
        .select({ child_code: children.childCode, domain: developmentGoals.domain, title: developmentGoals.title, version: developmentGoals.version, current: developmentGoals.isCurrent, status: developmentGoals.status, review_date: developmentGoals.reviewDate, responsible: staff.fullName })
        .from(developmentGoals)
        .innerJoin(children, eq(children.id, developmentGoals.childId))
        .innerJoin(staff, eq(staff.id, developmentGoals.responsibleStaffId))
        .orderBy(asc(children.childCode));
      break;
    case "consents": {
      const rec = alias(staff, "rec");
      rows = await tx
        .select({ child_code: children.childCode, consent_type: consents.consentType, status: consents.status, method: consents.method, effective_date: consents.effectiveDate, recorded_by: rec.fullName, recorded_at: consents.createdAt })
        .from(consents)
        .innerJoin(children, eq(children.id, consents.childId))
        .innerJoin(rec, eq(rec.id, consents.recordedBy))
        .orderBy(asc(children.childCode), asc(consents.createdAt));
      break;
    }
    case "staff":
      rows = await tx
        .select({ full_name: staff.fullName, email: userAccounts.email, role: staffRoles.role, active: staff.isActive, designation: staff.designation })
        .from(staff)
        .innerJoin(userAccounts, eq(userAccounts.id, staff.userId))
        .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
        .orderBy(asc(staff.fullName));
      break;
  }
  await audit(tx, actor, { action: "data.exported", entityType: "export", entityId: dataset, summary: `${rows.length} rows` });
  return toCsv(rows);
}
