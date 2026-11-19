import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pool, withOrg } from "@/db";
import * as schema from "@/db/schema";
import {
  archiveChild,
  enableGuardianPortal,
  getChild,
  listChildren,
  listGuardians,
  recordConsent,
  registerChild,
  restoreChild,
  updateChild,
} from "@/server/services/children";
import { listAudit } from "@/server/services/audit-log";
import { ForbiddenError, NotFoundError, AppError } from "@/server/errors";
import { assign, childInput, createOrg, owner, ownerPool, type Org } from "./helpers";

let org: Org;
const ctx = () => ({ orgId: org.orgId });

beforeAll(async () => {
  org = await createOrg();
});
afterAll(async () => {
  await pool.end();
  await ownerPool.end();
});

describe("child registration", () => {
  it("creates sequential child IDs, a guardian link and registration consent", async () => {
    const a = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("Alpha Test")));
    const b = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.coordinator, childInput("Beta Test")));
    expect(a.code).toBe("CDC-0001");
    expect(b.code).toBe("CDC-0002");
    const guardians = await withOrg(ctx(), (tx) => listGuardians(tx, org.actors.admin, a.id));
    expect(guardians).toHaveLength(1);
    expect(guardians[0].isPrimary).toBe(true);
    const consents = await owner.select().from(schema.consents).where(eq(schema.consents.childId, a.id));
    expect(consents.map((c) => c.consentType)).toContain("registration_data_processing");
  });

  it("refuses registration by a therapist", async () => {
    await expect(withOrg(ctx(), (tx) => registerChild(tx, org.actors.speech, childInput()))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("child editing, history and archive", () => {
  it("records field-level changes in the audit trail", async () => {
    const { id } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("Gamma Test")));
    const { child } = await withOrg(ctx(), (tx) => getChild(tx, org.actors.admin, id));
    await withOrg(ctx(), (tx) =>
      updateChild(tx, org.actors.admin, {
        ...childInput("Gamma Updated"),
        id,
        dateOfBirth: child.dateOfBirth,
        parentConcerns: "New concern text",
        status: "on_hold",
      }),
    );
    const { child: after } = await withOrg(ctx(), (tx) => getChild(tx, org.actors.admin, id));
    expect(after.fullName).toBe("Gamma Updated");
    expect(after.status).toBe("on_hold");
    const log = await withOrg(ctx(), (tx) => listAudit(tx, org.actors.admin, { childId: id }));
    const upd = log.find((l) => l.action === "child.updated");
    expect(upd?.changes).toMatchObject({ fullName: { from: "Gamma Test", to: "Gamma Updated" }, status: { from: "active", to: "on_hold" } });
  });

  it("archives without deleting and can restore", async () => {
    const { id } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("Delta Test")));
    await withOrg(ctx(), (tx) => archiveChild(tx, org.actors.admin, id, "Moved away (test)"));
    const active = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.admin, {}));
    expect(active.rows.find((r) => r.id === id)).toBeUndefined();
    const archived = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.admin, { status: "archived" }));
    expect(archived.rows.find((r) => r.id === id)).toBeDefined();
    await expect(
      withOrg(ctx(), (tx) => updateChild(tx, org.actors.admin, { ...childInput("Delta"), id, status: "active" })),
    ).rejects.toBeInstanceOf(AppError);
    await withOrg(ctx(), (tx) => restoreChild(tx, org.actors.admin, id));
    const [row] = await owner.select().from(schema.children).where(eq(schema.children.id, id));
    expect(row.status).toBe("active");
  });

  it("supports search by name and child ID", async () => {
    const res = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.admin, { q: "cdc-0001" }));
    expect(res.rows.map((r) => r.childCode)).toEqual(["CDC-0001"]);
    const byName = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.admin, { q: "beta" }));
    expect(byName.rows.map((r) => r.fullName)).toEqual(["Beta Test"]);
  });
});

describe("care-team based visibility", () => {
  it("therapists only see children on their care team", async () => {
    const { id } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("Epsilon Test")));
    const before = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.speech, {}));
    expect(before.rows).toHaveLength(0);
    await expect(withOrg(ctx(), (tx) => getChild(tx, org.actors.speech, id))).rejects.toBeInstanceOf(NotFoundError);
    await assign(org, id, "speech", "speech_therapy");
    const after = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.speech, {}));
    expect(after.rows.map((r) => r.id)).toEqual([id]);
    const { access } = await withOrg(ctx(), (tx) => getChild(tx, org.actors.speech, id));
    expect(access.canWriteClinical).toBe(true);
    expect(access.canEditProfile).toBe(false);
  });

  it("filters by service", async () => {
    const res = await withOrg(ctx(), (tx) => listChildren(tx, org.actors.admin, { service: "speech_therapy" }));
    expect(res.rows.map((r) => r.fullName)).toEqual(["Epsilon Test"]);
  });
});

describe("consent and parent portal accounts", () => {
  it("requires portal consent before creating a guardian login and withdrawing consent removes access", async () => {
    const { id } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, { ...childInput("Zeta Test"), guardian: { ...childInput().guardian, email: `zeta.${Date.now()}@test.local` } }));
    const [g] = await withOrg(ctx(), (tx) => listGuardians(tx, org.actors.admin, id));
    await expect(withOrg(ctx(), (tx) => enableGuardianPortal(tx, org.actors.admin, id, g.id))).rejects.toThrow("children.portalNeedsConsent");
    const consent = { childId: id, consentType: "parent_portal" as const, status: "granted" as const, givenByGuardianId: g.id, method: "paper_form" as const, effectiveDate: "2026-01-01", notes: "" };
    await withOrg(ctx(), (tx) => recordConsent(tx, org.actors.admin, consent));
    const { password } = await withOrg(ctx(), (tx) => enableGuardianPortal(tx, org.actors.admin, id, g.id));
    expect(password).toMatch(/^[A-Za-z2-9]{12}$/);
    const [account] = await owner.select().from(schema.userAccounts).where(eq(schema.userAccounts.email, g.email!));
    expect(account.mustChangePassword).toBe(true);
    expect(account.passwordHash).not.toContain(password!);
    await withOrg(ctx(), (tx) => recordConsent(tx, org.actors.admin, { ...consent, status: "withdrawn" }));
    const [link] = await owner.select().from(schema.childGuardians).where(eq(schema.childGuardians.childId, id));
    expect(link.portalAccess).toBe(false);
  });
});
