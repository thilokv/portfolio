import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool, withOrg } from "@/db";
import * as schema from "@/db/schema";
import { getChild, listChildren, registerChild } from "@/server/services/children";
import { listAudit } from "@/server/services/audit-log";
import { createAppointments } from "@/server/services/scheduling";
import { portalAppointments, portalChildren, portalMessages, portalReports, sendFeedback, updateContact } from "@/server/services/portal";
import { listStaff, setStaffActive, updateStaff, createStaff } from "@/server/services/admin";
import { exportDataset } from "@/server/services/export";
import { ForbiddenError, NotFoundError, toActionError } from "@/server/errors";
import type { GuardianActor } from "@/server/auth/actor";
import { assign, childInput, createOrg, futureSlot, grantConsent, guardianActorFor, owner, ownerPool, type Org } from "./helpers";
import { isoDateIST } from "@/lib/dates";

let a: Org;
let b: Org;
let childA: string;
let childA2: string;
let childB: string;
let parentA: GuardianActor;

beforeAll(async () => {
  a = await createOrg();
  b = await createOrg();
  childA = (await withOrg({ orgId: a.orgId }, (tx) => registerChild(tx, a.actors.admin, childInput("Org A Child")))).id;
  childA2 = (await withOrg({ orgId: a.orgId }, (tx) => registerChild(tx, a.actors.admin, childInput("Org A Sibling")))).id;
  childB = (await withOrg({ orgId: b.orgId }, (tx) => registerChild(tx, b.actors.admin, childInput("Org B Child")))).id;
  await assign(a, childA, "speech", "speech_therapy");
  await assign(a, childA2, "speech", "speech_therapy");
  await grantConsent(a, childA, "therapy_services");
  await grantConsent(a, childA2, "therapy_services");
  parentA = await guardianActorFor(a, childA);
  await withOrg({ orgId: a.orgId }, (tx) =>
    createAppointments(tx, a.actors.admin, { childId: childA, serviceId: a.services.speech_therapy, staffId: a.actors.speech.staffId, start: futureSlot(4), durationMinutes: "45", room: "", adminNotes: "", repeatWeeks: "0" }),
  );
  await withOrg({ orgId: a.orgId }, (tx) =>
    createAppointments(tx, a.actors.admin, { childId: childA2, serviceId: a.services.speech_therapy, staffId: a.actors.speech.staffId, start: futureSlot(4, "12:00"), durationMinutes: "45", room: "", adminNotes: "", repeatWeeks: "0" }),
  );
});
afterAll(async () => {
  await pool.end();
  await ownerPool.end();
});

describe("organization isolation (RLS)", () => {
  it("the runtime role sees nothing without an organization context", async () => {
    const rows = await db.select().from(schema.children);
    expect(rows).toHaveLength(0);
    const audits = await db.select().from(schema.auditLogs);
    expect(audits).toHaveLength(0);
  });

  it("an org B administrator cannot see or open org A children", async () => {
    const list = await withOrg({ orgId: b.orgId }, (tx) => listChildren(tx, b.actors.admin, { status: "all" }));
    expect(list.rows.map((r) => r.id)).toEqual([childB]);
    await expect(withOrg({ orgId: b.orgId }, (tx) => getChild(tx, b.actors.admin, childA))).rejects.toBeInstanceOf(NotFoundError);
    const raw = await withOrg({ orgId: b.orgId }, (tx) => tx.select().from(schema.children).where(eq(schema.children.id, childA)));
    expect(raw).toHaveLength(0);
  });

  it("cannot write rows into another organization", async () => {
    const err = await withOrg({ orgId: b.orgId }, (tx) =>
      tx.insert(schema.consents).values({ organizationId: a.orgId, childId: childA, consentType: "assessment", status: "granted", effectiveDate: isoDateIST(), recordedBy: b.actors.admin.staffId }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
  });

  it("cannot reference another organization's child even with its own org id (composite FK)", async () => {
    const err = await withOrg({ orgId: b.orgId }, (tx) =>
      tx.insert(schema.consents).values({ organizationId: b.orgId, childId: childA, consentType: "assessment", status: "granted", effectiveDate: isoDateIST(), recordedBy: b.actors.admin.staffId }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err.cause?.message ?? err.message)).toMatch(/foreign key|violates/);
  });

  it("cannot update another organization's rows", async () => {
    await withOrg({ orgId: b.orgId }, (tx) => tx.update(schema.children).set({ fullName: "hijacked" }).where(eq(schema.children.id, childA)));
    const [row] = await owner.select().from(schema.children).where(eq(schema.children.id, childA));
    expect(row.fullName).toBe("Org A Child");
  });

  it("audit logs are scoped to the organization and append-only", async () => {
    const logs = await withOrg({ orgId: b.orgId }, (tx) => listAudit(tx, b.actors.admin, {}));
    expect(logs.every((l) => l.organizationId === b.orgId)).toBe(true);
    const err = await withOrg({ orgId: a.orgId }, (tx) => tx.update(schema.auditLogs).set({ summary: "x" })).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const err2 = await withOrg({ orgId: a.orgId }, (tx) => tx.execute(sql`delete from audit_logs`)).catch((e) => e);
    expect(err2).toBeInstanceOf(Error);
  });
});

describe("unauthorized access attempts by staff", () => {
  it("therapists cannot read the audit log, manage staff or export data", async () => {
    await expect(withOrg({ orgId: a.orgId }, (tx) => listAudit(tx, a.actors.speech, {}))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(withOrg({ orgId: a.orgId }, (tx) => listStaff(tx, a.actors.speech))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(withOrg({ orgId: a.orgId }, (tx) => exportDataset(tx, a.actors.coordinator, "children"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("protects the last administrator and self-deactivation", async () => {
    await expect(withOrg({ orgId: a.orgId }, (tx) => setStaffActive(tx, a.actors.admin, a.actors.admin.staffId, false))).rejects.toThrow("admin.cannotDeactivateSelf");
    await expect(
      withOrg({ orgId: a.orgId }, (tx) => updateStaff(tx, a.actors.admin, { id: a.actors.admin.staffId, fullName: "x", email: a.actors.admin.email, phone: "", designation: "", qualifications: "", registrationNumber: "", roles: ["speech_therapist"] })),
    ).rejects.toThrow("admin.lastAdmin");
  });

  it("creates staff with multiple roles and a temporary password", async () => {
    const res = await withOrg({ orgId: a.orgId }, (tx) =>
      createStaff(tx, a.actors.admin, { fullName: "New Multi", email: `multi.${Date.now()}@test.local`, phone: "", designation: "", qualifications: "", registrationNumber: "", roles: ["special_educator", "behaviour_professional"] }),
    );
    const roles = await owner.select().from(schema.staffRoles).where(eq(schema.staffRoles.staffId, res.id));
    expect(roles.map((r) => r.role).sort()).toEqual(["behaviour_professional", "special_educator"]);
    expect(res.password.length).toBe(12);
  });

  it("deactivating a staff member revokes their sessions", async () => {
    await owner.insert(schema.authSessions).values({ userId: a.actors.ot.userId, tokenHash: crypto.randomUUID().replace(/-/g, "").padEnd(64, "0"), expiresAt: new Date(Date.now() + 3600_000) });
    await withOrg({ orgId: a.orgId }, (tx) => setStaffActive(tx, a.actors.admin, a.actors.ot.staffId, false));
    const [s] = await owner.select().from(schema.authSessions).where(eq(schema.authSessions.userId, a.actors.ot.userId));
    expect(s.revokedAt).not.toBeNull();
  });
});

describe("parent portal isolation", () => {
  const gctx = () => ({ orgId: a.orgId, guardianId: parentA.guardianId });

  it("a parent sees only their own child and appointments", async () => {
    const kids = await withOrg(gctx(), (tx) => portalChildren(tx, parentA));
    expect(kids.map((k) => k.id)).toEqual([childA]);
    const appts = await withOrg(gctx(), (tx) => portalAppointments(tx, parentA));
    expect(appts).toHaveLength(1);
    // Direct queries are filtered by RLS too.
    const raw = await withOrg(gctx(), (tx) => tx.select().from(schema.children));
    expect(raw.map((r) => r.id)).toEqual([childA]);
    const rawAppts = await withOrg(gctx(), (tx) => tx.select().from(schema.appointments));
    expect(rawAppts.every((r) => r.childId === childA)).toBe(true);
  });

  it("a parent can never read clinical notes, assessments, goals, staff roles or audit logs", async () => {
    for (const table of [schema.assessments, schema.therapySessions, schema.developmentGoals, schema.goalObservations, schema.consents, schema.staffRoles, schema.auditLogs, schema.aiDrafts]) {
      const rows = await withOrg(gctx(), (tx) => tx.select().from(table));
      expect(rows).toHaveLength(0);
    }
  });

  it("unshared reports are invisible; shared reports are visible", async () => {
    await owner.insert(schema.reports).values([
      { organizationId: a.orgId, childId: childA, reportType: "progress_summary", title: "Draft", content: "draft", status: "approved", authorStaffId: a.actors.speech.staffId },
      { organizationId: a.orgId, childId: childA, reportType: "progress_summary", title: "Shared", content: "shared", status: "shared", sharedAt: new Date(), authorStaffId: a.actors.speech.staffId },
      { organizationId: a.orgId, childId: childA2, reportType: "progress_summary", title: "Sibling", content: "x", status: "shared", sharedAt: new Date(), authorStaffId: a.actors.speech.staffId },
    ]);
    const reports = await withOrg(gctx(), (tx) => portalReports(tx, parentA));
    expect(reports.map((r) => r.title)).toEqual(["Shared"]);
  });

  it("a parent cannot post a message about another child or impersonate staff", async () => {
    await expect(withOrg(gctx(), (tx) => sendFeedback(tx, parentA, { childId: childA2, subject: "x", body: "y" }))).rejects.toBeInstanceOf(NotFoundError);
    const err = await withOrg(gctx(), (tx) =>
      tx.insert(schema.parentMessages).values({ organizationId: a.orgId, childId: childA, kind: "update", direction: "to_guardian", senderStaffId: a.actors.speech.staffId, subject: "fake", body: "fake" }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    await withOrg(gctx(), (tx) => sendFeedback(tx, parentA, { childId: childA, subject: "Thanks", body: "Feedback (test)" }));
    const msgs = await withOrg(gctx(), (tx) => portalMessages(tx, parentA));
    expect(msgs.map((m) => m.m.subject)).toContain("Thanks");
  });

  it("a parent can update only their own contact details", async () => {
    await withOrg(gctx(), (tx) => updateContact(tx, parentA, { phone: "9123456780", alternatePhone: "", address: "New fictional address", preferredLanguage: "te" }));
    const [g] = await owner.select().from(schema.guardians).where(eq(schema.guardians.id, parentA.guardianId));
    expect(g.phone).toBe("9123456780");
    const [other] = await owner.select().from(schema.childGuardians).where(eq(schema.childGuardians.childId, childA2));
    await withOrg(gctx(), (tx) => tx.update(schema.guardians).set({ phone: "9000000001" }).where(eq(schema.guardians.id, other.guardianId)));
    const [g2] = await owner.select().from(schema.guardians).where(eq(schema.guardians.id, other.guardianId));
    expect(g2.phone).not.toBe("9000000001");
  });

  it("a parent from another organization sees nothing", async () => {
    const rows = await withOrg({ orgId: b.orgId, guardianId: parentA.guardianId }, (tx) => tx.select().from(schema.children));
    expect(rows).toHaveLength(0);
  });

  it("maps a missing-org context error to a safe message", () => {
    expect(toActionError(new Error("boom")).error).toBe("errors.unexpected");
  });
});
