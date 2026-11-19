/**
 * Seeds a FICTIONAL demo organization. Never run against production.
 *
 *   npm run db:seed          (refuses to run if the demo org already exists)
 *
 * Every person, phone number and clinical note below is invented for
 * demonstration and testing. All demo accounts share the password printed at
 * the end; change or disable them before any real use.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/server/auth/crypto";
import { registerChild } from "../src/server/services/children";
import type { StaffActor } from "../src/server/auth/actor";
import { permissionsFor } from "../src/lib/permissions";
import { addDays, isoDateIST, fromLocalDateTime } from "../src/lib/dates";
import type { StaffRole, ServiceCode } from "../src/lib/constants";

export const DEMO_PASSWORD = "CareOS-Demo-2026";

const SERVICES: { code: ServiceCode; name: string; nameTe: string; minutes: number }[] = [
  { code: "early_intervention", name: "Early intervention", nameTe: "ముందస్తు జోక్యం", minutes: 45 },
  { code: "speech_therapy", name: "Speech & language therapy", nameTe: "స్పీచ్ & భాషా థెరపీ", minutes: 45 },
  { code: "occupational_therapy", name: "Occupational therapy", nameTe: "ఆక్యుపేషనల్ థెరపీ", minutes: 45 },
  { code: "special_education", name: "Special education", nameTe: "ప్రత్యేక విద్య", minutes: 60 },
  { code: "behaviour_support", name: "Behaviour support", nameTe: "ప్రవర్తన సహాయం", minutes: 45 },
  { code: "physiotherapy", name: "Physiotherapy", nameTe: "ఫిజియోథెరపీ", minutes: 45 },
  { code: "psychology", name: "Psychological services", nameTe: "మానసిక సేవలు", minutes: 60 },
];

const STAFF: { key: string; name: string; roles: StaffRole[]; designation: string; qualifications: string }[] = [
  { key: "admin", name: "Lakshmi Prasanna (Demo)", roles: ["admin"], designation: "Center administrator", qualifications: "MBA (fictional)" },
  { key: "coordinator", name: "Dr. Ravi Varma (Demo)", roles: ["clinical_coordinator"], designation: "Clinical coordinator", qualifications: "Fictional demo qualification" },
  { key: "speech", name: "Sravani K (Demo)", roles: ["speech_therapist"], designation: "Speech-language pathologist", qualifications: "Fictional demo qualification" },
  { key: "ot", name: "Kiran Kumar (Demo)", roles: ["occupational_therapist"], designation: "Occupational therapist", qualifications: "Fictional demo qualification" },
  { key: "sped", name: "Anitha Reddy (Demo)", roles: ["special_educator", "behaviour_professional"], designation: "Special educator", qualifications: "Fictional demo qualification" },
  { key: "physio", name: "Naresh P (Demo)", roles: ["physiotherapist"], designation: "Paediatric physiotherapist", qualifications: "Fictional demo qualification" },
  { key: "psych", name: "Dr. Swathi Rao (Demo)", roles: ["psychologist"], designation: "Clinical psychologist", qualifications: "Fictional demo qualification" },
  { key: "behaviour", name: "Farhana Begum (Demo)", roles: ["behaviour_professional"], designation: "Behaviour therapist", qualifications: "Fictional demo qualification" },
];

const CHILDREN = [
  { name: "Aarav Demo", dobYearsAgo: 4.2, lang: "te", guardian: "Padma Demo", rel: "mother", team: ["speech", "ot"] },
  { name: "Saanvi Demo", dobYearsAgo: 3.1, lang: "te", guardian: "Srinivas Demo", rel: "father", team: ["speech", "sped"] },
  { name: "Vihaan Demo", dobYearsAgo: 5.5, lang: "en", guardian: "Kavya Demo", rel: "mother", team: ["ot", "physio"] },
  { name: "Harshini Demo", dobYearsAgo: 2.4, lang: "te", guardian: "Ramesh Demo", rel: "father", team: ["speech"] },
  { name: "Charan Demo", dobYearsAgo: 6.3, lang: "te", guardian: "Lavanya Demo", rel: "mother", team: ["sped", "behaviour", "psych"] },
  { name: "Deekshitha Demo", dobYearsAgo: 1.8, lang: "te", guardian: "Venkat Demo", rel: "father", team: ["physio"] },
  { name: "Rithvik Demo", dobYearsAgo: 4.9, lang: "te", guardian: "Sunitha Demo", rel: "mother", team: ["speech", "behaviour"] },
  { name: "Lasya Demo", dobYearsAgo: 3.7, lang: "en", guardian: "Mohan Demo", rel: "father", team: ["ot"] },
  { name: "Yashwanth Demo", dobYearsAgo: 5.9, lang: "te", guardian: "Durga Demo", rel: "grandparent", team: ["sped"] },
  { name: "Pranavi Demo", dobYearsAgo: 2.9, lang: "te", guardian: "Suresh Demo", rel: "father", team: ["speech", "ot"] },
];

const SERVICE_BY_STAFF: Record<string, ServiceCode> = {
  speech: "speech_therapy",
  ot: "occupational_therapy",
  sped: "special_education",
  physio: "physiotherapy",
  psych: "psychology",
  behaviour: "behaviour_support",
};

function dobFromYears(years: number): string {
  return addDays(isoDateIST(), -Math.round(years * 365.25));
}

async function main() {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL not set");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const pool = new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
  const db = drizzle(pool, { schema });
  const existing = await db.select().from(schema.organizations).where(eq(schema.organizations.code, "DEMO"));
  if (existing.length) {
    console.log("Demo organization already exists — nothing to do. Use `npm run db:reset` to start over.");
    await pool.end();
    return;
  }
  const pw = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: "Sunrise Child Development Centre (Demo)", code: "DEMO", childIdPrefix: "CDC", address: "Fictional address, Vijayawada, Andhra Pradesh" })
      .returning();
    await tx.execute(sql`select set_config('app.current_org', ${org.id}, true)`);

    const svc: Record<string, string> = {};
    for (const s of SERVICES) {
      const [row] = await tx
        .insert(schema.services)
        .values({ organizationId: org.id, code: s.code, name: s.name, nameTe: s.nameTe, defaultDurationMinutes: s.minutes })
        .returning();
      svc[s.code] = row.id;
    }

    const staffIds: Record<string, string> = {};
    const actors: Record<string, StaffActor> = {};
    for (const s of STAFF) {
      const email = `${s.key}@demo.careos.local`;
      const [user] = await tx
        .insert(schema.userAccounts)
        .values({ organizationId: org.id, email, passwordHash: pw, accountType: "staff" })
        .returning();
      const [st] = await tx
        .insert(schema.staff)
        .values({ organizationId: org.id, userId: user.id, fullName: s.name, designation: s.designation, qualifications: s.qualifications, phone: "9000000000" })
        .returning();
      for (const role of s.roles) await tx.insert(schema.staffRoles).values({ organizationId: org.id, staffId: st.id, role });
      staffIds[s.key] = st.id;
      actors[s.key] = {
        kind: "staff",
        userId: user.id,
        orgId: org.id,
        staffId: st.id,
        name: s.name,
        email,
        roles: s.roles,
        permissions: [...permissionsFor(s.roles)],
        locale: "en",
        mustChangePassword: false,
      };
    }

    const today = isoDateIST();
    // Physiotherapist is marked on leave today to demonstrate availability.
    await tx.insert(schema.staffAvailability).values({ organizationId: org.id, staffId: staffIds.physio, date: today, status: "leave", note: "Demo leave", createdBy: staffIds.admin });

    const childIds: string[] = [];
    const guardianIds: string[] = [];
    for (const [i, c] of CHILDREN.entries()) {
      const { id } = await registerChild(tx as never, actors.admin, {
        fullName: c.name,
        preferredName: c.name.split(" ")[0],
        dateOfBirth: dobFromYears(c.dobYearsAgo),
        sex: i % 2 === 0 ? "male" : "female",
        preferredLanguage: c.lang as "te" | "en",
        address: "Fictional address, Vijayawada",
        emergencyContactName: `${c.guardian} (relative)`,
        emergencyContactPhone: `90000001${String(i).padStart(2, "0")}`,
        emergencyContactRelation: "Relative",
        developmentalHistory: "DEMO RECORD — fictional history for testing only.",
        parentConcerns: "DEMO — fictional parent concern for testing only.",
        medicalHistory: "",
        existingReportsSummary: "",
        referralSource: "Demo referral",
        guardian: {
          fullName: c.guardian,
          phone: `90000000${String(i).padStart(2, "0")}`,
          alternatePhone: "",
          email: i === 0 ? "parent@demo.careos.local" : "",
          relationship: c.rel as "mother",
          preferredLanguage: c.lang as "te" | "en",
        },
        consentRegistration: true,
      });
      childIds.push(id);
      const [link] = await tx.select().from(schema.childGuardians).where(eq(schema.childGuardians.childId, id));
      guardianIds.push(link.guardianId);
      await tx.insert(schema.childAssignments).values({ organizationId: org.id, childId: id, staffId: staffIds.coordinator, isLead: true, assignedBy: staffIds.admin });
      for (const key of c.team) {
        await tx.insert(schema.childAssignments).values({ organizationId: org.id, childId: id, staffId: staffIds[key], serviceId: svc[SERVICE_BY_STAFF[key]], assignedBy: staffIds.admin });
      }
      for (const type of ["assessment", "therapy_services"] as const) {
        await tx.insert(schema.consents).values({ organizationId: org.id, childId: id, consentType: type, status: "granted", givenByGuardianId: link.guardianId, method: "paper_form", effectiveDate: today, recordedBy: staffIds.admin });
      }
    }

    // Parent portal login for the first child's guardian.
    await tx.insert(schema.consents).values({ organizationId: org.id, childId: childIds[0], consentType: "parent_portal", status: "granted", givenByGuardianId: guardianIds[0], method: "paper_form", effectiveDate: today, recordedBy: staffIds.admin });
    const [parentUser] = await tx.insert(schema.userAccounts).values({ organizationId: org.id, email: "parent@demo.careos.local", passwordHash: pw, accountType: "guardian", preferredLocale: "te" }).returning();
    await tx.update(schema.guardians).set({ userId: parentUser.id, email: "parent@demo.careos.local" }).where(eq(schema.guardians.id, guardianIds[0]));
    await tx.update(schema.childGuardians).set({ portalAccess: true }).where(eq(schema.childGuardians.childId, childIds[0]));

    // Development plan with goals for the first child (fictional).
    const [plan] = await tx
      .insert(schema.developmentPlans)
      .values({ organizationId: org.id, childId: childIds[0], title: "IDP — Term 1 (Demo)", startDate: addDays(today, -35), reviewDate: addDays(today, 20), status: "active", familyPriorities: "DEMO — family would like more two-word requests at home.", createdBy: staffIds.coordinator, approvedBy: staffIds.coordinator, approvedAt: new Date() })
      .returning();
    const goalSpecs = [
      { domain: "expressive_language", service: "speech_therapy", owner: "speech", title: "Requests preferred items using two-word phrases", baseline: "DEMO: uses single words to request in 2 of 10 opportunities (therapist observation, week 1).", target: "Uses two-word phrases to request in 8 of 10 opportunities across 3 consecutive sessions.", method: "Trial data per session (opportunities vs. successful requests).", pct: 80 },
      { domain: "fine_motor", service: "occupational_therapy", owner: "ot", title: "Uses a pincer grasp to pick up small objects", baseline: "DEMO: picks up small pegs with a raking grasp; pincer grasp in 1 of 10 trials.", target: "Picks up 10 small pegs with a pincer grasp in 8 of 10 trials.", method: "Trial count per session.", pct: 80 },
    ] as const;
    const goalIds: { id: string; owner: string; service: string }[] = [];
    for (const g of goalSpecs) {
      const groupId = crypto.randomUUID();
      const [goal] = await tx
        .insert(schema.developmentGoals)
        .values({ organizationId: org.id, planId: plan.id, childId: childIds[0], goalGroupId: groupId, domain: g.domain, serviceId: svc[g.service], title: g.title, baseline: g.baseline, target: g.target, measurementMethod: g.method, targetPercent: g.pct, strategies: "DEMO strategies: modelling, expectant pause, choice-making.", responsibleStaffId: staffIds[g.owner], reviewDate: addDays(today, 20), status: "in_progress", createdBy: staffIds.coordinator })
        .returning();
      goalIds.push({ id: goal.id, owner: g.owner, service: g.service });
    }

    // Past signed sessions with fictional observations (weekly, 5 weeks).
    const trialSeries: Record<string, [number, number, string][]> = {
      speech: [[10, 2, "modelling"], [10, 3, "verbal_prompt"], [10, 3, "verbal_prompt"], [10, 5, "gestural_prompt"], [10, 6, "verbal_prompt"]],
      ot: [[10, 1, "full_physical"], [10, 2, "partial_physical"], [10, 4, "partial_physical"], [10, 4, "modelling"], [10, 5, "modelling"]],
    };
    for (const g of goalIds) {
      for (let w = 0; w < 5; w++) {
        const day = addDays(today, -35 + w * 7 + (g.owner === "ot" ? 1 : 0));
        const start = fromLocalDateTime(`${day}T${g.owner === "ot" ? "11" : "10"}:00`);
        const end = new Date(start.getTime() + 45 * 60_000);
        const [appt] = await tx.insert(schema.appointments).values({ organizationId: org.id, childId: childIds[0], serviceId: svc[g.service], staffId: staffIds[g.owner], startsAt: start, endsAt: end, status: "completed", attendance: "present", createdBy: staffIds.admin }).returning();
        const [session] = await tx
          .insert(schema.therapySessions)
          .values({ organizationId: org.id, appointmentId: appt.id, childId: childIds[0], serviceId: svc[g.service], therapistStaffId: staffIds[g.owner], sessionDate: day, startedAt: start, endedAt: end, status: "completed", attendance: "present", activitiesCompleted: "DEMO activities (fictional).", childResponse: "DEMO response (fictional).", workflowData: {} })
          .returning();
        await tx.insert(schema.sessionGoals).values({ organizationId: org.id, sessionId: session.id, goalId: g.id });
        const [total, ok, assist] = trialSeries[g.owner][w];
        // One OT observation deliberately has no trial data to show that gaps are not filled.
        const noTrials = g.owner === "ot" && w === 2;
        await tx.insert(schema.goalObservations).values({ organizationId: org.id, goalId: g.id, childId: childIds[0], sessionId: session.id, observedOn: day, observedBy: staffIds[g.owner], trialsTotal: noTrials ? null : total, trialsSuccessful: noTrials ? null : ok, independentTrials: noTrials ? null : Math.max(0, ok - 2), assistanceLevel: assist as "modelling", note: noTrials ? "DEMO: child unsettled; trials not run, qualitative note only." : null });
        await tx.update(schema.therapySessions).set({ status: "signed", signedAt: end }).where(eq(schema.therapySessions.id, session.id));
      }
    }

    // Today's appointments.
    const todaySlots: [number, string, string][] = [
      [0, "speech", "09:30"], [1, "sped", "10:00"], [2, "ot", "10:30"], [3, "speech", "11:30"],
      [4, "behaviour", "12:00"], [6, "speech", "14:00"], [7, "ot", "15:00"], [9, "ot", "16:00"],
    ];
    for (const [ci, key, time] of todaySlots) {
      const start = fromLocalDateTime(`${today}T${time}`);
      await tx.insert(schema.appointments).values({ organizationId: org.id, childId: childIds[ci], serviceId: svc[SERVICE_BY_STAFF[key]], staffId: staffIds[key], startsAt: start, endsAt: new Date(start.getTime() + 45 * 60_000), room: `Room ${1 + (ci % 3)}`, createdBy: staffIds.admin });
    }
    // Upcoming week for child 1.
    for (const d of [2, 7]) {
      const start = fromLocalDateTime(`${addDays(today, d)}T10:00`);
      await tx.insert(schema.appointments).values({ organizationId: org.id, childId: childIds[0], serviceId: svc.speech_therapy, staffId: staffIds.speech, startsAt: start, endsAt: new Date(start.getTime() + 45 * 60_000), room: "Room 1", createdBy: staffIds.admin });
    }

    // Shared report + home activity for the parent portal demo.
    await tx.insert(schema.reports).values({ organizationId: org.id, childId: childIds[0], reportType: "progress_summary", title: "Progress summary — Demo month", periodStart: addDays(today, -35), periodEnd: today, content: "DEMO REPORT (fictional). Aarav attended 5 speech and 5 occupational therapy sessions this period. Recorded observations are shown in the progress charts. This is sample text for testing the parent portal.", contentTe: "డెమో నివేదిక (కల్పితం). ఈ కాలంలో ఆరవ్ 5 స్పీచ్ మరియు 5 ఆక్యుపేషనల్ థెరపీ సెషన్లకు హాజరయ్యాడు. ఇది పేరెంట్ పోర్టల్ పరీక్ష కోసం నమూనా పాఠం.", teTranslationReviewedBy: staffIds.coordinator, status: "shared", authorStaffId: staffIds.speech, approvedBy: staffIds.coordinator, approvedAt: new Date(), sharedAt: new Date() });
    await tx.insert(schema.parentMessages).values({ organizationId: org.id, childId: childIds[0], kind: "home_activity", direction: "to_guardian", senderStaffId: staffIds.speech, subject: "Snack-time choices (Demo)", body: "During snack time, hold up two snacks and wait for your child to ask. Name the item with two words (\"want banana\") and give it right away. Keep it fun and stop if your child is upset.", bodyTe: "స్నాక్ సమయంలో రెండు తినుబండారాలు చూపించి, మీ బిడ్డ అడిగే వరకు కొంచెం ఆగండి. రెండు పదాలతో (\"అరటిపండు కావాలి\") పేరు చెప్పి వెంటనే ఇవ్వండి. సరదాగా ఉంచండి, బిడ్డ బాధపడితే ఆపేయండి.", teTranslationReviewedBy: staffIds.speech, status: "sent", sentAt: new Date() });
  });
  console.log(`\nDemo data created (fictional).\nSign in at /login with any of:\n  ${STAFF.map((s) => `${s.key}@demo.careos.local`).join("\n  ")}\n  parent@demo.careos.local (parent portal)\nPassword for all demo accounts: ${DEMO_PASSWORD}\n`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
