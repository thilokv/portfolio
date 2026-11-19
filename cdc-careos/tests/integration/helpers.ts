/**
 * Integration-test fixtures. Fixtures are written with the OWNER role; all
 * behaviour under test runs through the app's services with the restricted
 * runtime role (DATABASE_URL), so Row Level Security is genuinely enforced.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { permissionsFor } from "@/lib/permissions";
import type { GuardianActor, StaffActor } from "@/server/auth/actor";
import type { ServiceCode, StaffRole } from "@/lib/constants";
import { addDays, isoDateIST } from "@/lib/dates";

export const ownerPool = new Pool({ connectionString: process.env.DATABASE_OWNER_URL });
export const owner = drizzle(ownerPool, { schema });

const rnd = () => Math.random().toString(36).slice(2, 8);

export interface Org {
  orgId: string;
  services: Record<ServiceCode, string>;
  actors: Record<string, StaffActor>;
}

const STAFF: Record<string, StaffRole[]> = {
  admin: ["admin"],
  coordinator: ["clinical_coordinator"],
  speech: ["speech_therapist"],
  speech2: ["speech_therapist"],
  ot: ["occupational_therapist"],
  psych: ["psychologist"],
};

export async function createOrg(): Promise<Org> {
  const code = `T${rnd()}`.toUpperCase();
  const [org] = await owner.insert(schema.organizations).values({ name: `Test org ${code}`, code }).returning();
  const services = {} as Record<ServiceCode, string>;
  for (const c of ["early_intervention", "speech_therapy", "occupational_therapy", "special_education", "behaviour_support", "physiotherapy", "psychology"] as const) {
    const [s] = await owner.insert(schema.services).values({ organizationId: org.id, code: c, name: c, defaultDurationMinutes: 45 }).returning();
    services[c] = s.id;
  }
  const actors: Record<string, StaffActor> = {};
  for (const [key, roles] of Object.entries(STAFF)) {
    const email = `${key}.${rnd()}@test.local`;
    const [u] = await owner.insert(schema.userAccounts).values({ organizationId: org.id, email, accountType: "staff", passwordHash: null }).returning();
    const [s] = await owner.insert(schema.staff).values({ organizationId: org.id, userId: u.id, fullName: `${key} ${code}` }).returning();
    for (const role of roles) await owner.insert(schema.staffRoles).values({ organizationId: org.id, staffId: s.id, role });
    actors[key] = { kind: "staff", userId: u.id, orgId: org.id, staffId: s.id, name: s.fullName, email, roles, permissions: [...permissionsFor(roles)], locale: "en", mustChangePassword: false };
  }
  return { orgId: org.id, services, actors };
}

export function childInput(name = "Fixture Child") {
  return {
    fullName: name,
    preferredName: "",
    dateOfBirth: addDays(isoDateIST(), -1000),
    sex: "" as const,
    preferredLanguage: "te" as const,
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    developmentalHistory: "",
    parentConcerns: "",
    medicalHistory: "",
    existingReportsSummary: "",
    referralSource: "",
    guardian: { fullName: `${name} Parent`, phone: "9876543210", alternatePhone: "", email: "", relationship: "mother" as const, preferredLanguage: "te" as const },
    consentRegistration: true,
  };
}

export async function assign(org: Org, childId: string, actorKey: string, service?: ServiceCode) {
  await owner.insert(schema.childAssignments).values({ organizationId: org.orgId, childId, staffId: org.actors[actorKey].staffId, serviceId: service ? org.services[service] : null });
}

export async function grantConsent(org: Org, childId: string, type: (typeof schema.consentTypeEnum.enumValues)[number]) {
  await owner.insert(schema.consents).values({ organizationId: org.orgId, childId, consentType: type, status: "granted", effectiveDate: isoDateIST(), recordedBy: org.actors.admin.staffId });
}

export async function guardianActorFor(org: Org, childId: string): Promise<GuardianActor> {
  const [link] = await owner.select().from(schema.childGuardians).where(eq(schema.childGuardians.childId, childId));
  const email = `parent.${rnd()}@test.local`;
  const [u] = await owner.insert(schema.userAccounts).values({ organizationId: org.orgId, email, accountType: "guardian" }).returning();
  await owner.update(schema.guardians).set({ userId: u.id, email }).where(eq(schema.guardians.id, link.guardianId));
  await owner.update(schema.childGuardians).set({ portalAccess: true }).where(eq(schema.childGuardians.childId, childId));
  return { kind: "guardian", userId: u.id, orgId: org.orgId, guardianId: link.guardianId, name: "Parent", email, locale: "te", mustChangePassword: false };
}

/** Next weekday 10:00 IST some days ahead, as datetime-local string. */
export function futureSlot(daysAhead: number, time = "10:00") {
  return `${addDays(isoDateIST(), daysAhead)}T${time}`;
}
