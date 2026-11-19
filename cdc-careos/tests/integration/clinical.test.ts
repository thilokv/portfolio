import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pool, withOrg } from "@/db";
import * as schema from "@/db/schema";
import { registerChild } from "@/server/services/children";
import { createAssessment, finalizeAssessment, getAssessment, listAssessments, updateAssessment } from "@/server/services/assessments";
import { addGoal, createPlan, getPlans, reviewGoal, reviseGoal, setPlanStatus } from "@/server/services/plans";
import {
  completeSession,
  createAppointments,
  getSession,
  saveSessionNote,
  signSession,
  startSession,
  cancelAppointment,
} from "@/server/services/scheduling";
import { getGoalProgress, periodSummary } from "@/server/services/progress";
import { createSummaryDraft, listReports, saveReport, transitionReport } from "@/server/services/communication";
import { generateDraft } from "@/server/services/ai";
import { AppError, ForbiddenError, toActionError } from "@/server/errors";
import { ASSESSMENT_FORM_DOMAINS } from "@/lib/constants";
import { addDays, isoDateIST } from "@/lib/dates";
import { assign, childInput, createOrg, futureSlot, grantConsent, owner, ownerPool, type Org } from "./helpers";

let org: Org;
let childId: string;
const ctx = () => ({ orgId: org.orgId });

beforeAll(async () => {
  org = await createOrg();
  ({ id: childId } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("Clinical Child"))));
  await assign(org, childId, "speech", "speech_therapy");
  await assign(org, childId, "speech2", "speech_therapy");
  await assign(org, childId, "psych", "psychology");
  await grantConsent(org, childId, "therapy_services");
});
afterAll(async () => {
  await pool.end();
  await ownerPool.end();
});

const assessment = (over: Partial<Parameters<typeof createAssessment>[2]> = {}) => ({
  childId,
  serviceId: org.services.speech_therapy,
  assessorRole: "speech_therapist" as const,
  assessmentDate: isoDateIST(),
  toolName: "Fictional checklist",
  toolVersion: "v1",
  reasonForAssessment: "",
  overallObservations: "Observed during play (test).",
  recommendations: "",
  reviewDate: addDays(isoDateIST(), 90),
  isRestricted: false,
  domains: ASSESSMENT_FORM_DOMAINS.map((domain, i) => ({ domain, findings: i === 0 ? "Uses single words (test)." : "", observations: "" })),
  ...over,
});

describe("developmental assessments", () => {
  it("creates, edits and finalizes; finalized records are locked in app and database", async () => {
    const id = await withOrg(ctx(), (tx) => createAssessment(tx, org.actors.speech, assessment()));
    await withOrg(ctx(), (tx) => updateAssessment(tx, org.actors.speech, id, assessment({ toolVersion: "v2" })));
    const a = await withOrg(ctx(), (tx) => getAssessment(tx, org.actors.speech, id));
    expect(a.toolVersion).toBe("v2");
    expect(a.domains).toHaveLength(1);
    await expect(withOrg(ctx(), (tx) => updateAssessment(tx, org.actors.speech2, id, assessment()))).rejects.toThrow("errors.notYourRecord");
    await withOrg(ctx(), (tx) => finalizeAssessment(tx, org.actors.speech, id));
    await expect(withOrg(ctx(), (tx) => updateAssessment(tx, org.actors.speech, id, assessment()))).rejects.toThrow("errors.recordLocked");
    // Even a direct SQL update by the app role is blocked by the trigger.
    const err = await withOrg(ctx(), (tx) => tx.update(schema.assessments).set({ toolName: "tampered" }).where(eq(schema.assessments.id, id))).catch((e) => e);
    expect(toActionError(err).error).toBe("errors.recordLocked");
  });

  it("rejects an assessor role the user does not hold or a service outside their profession", async () => {
    await expect(withOrg(ctx(), (tx) => createAssessment(tx, org.actors.speech, assessment({ assessorRole: "psychologist" })))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(withOrg(ctx(), (tx) => createAssessment(tx, org.actors.speech, assessment({ serviceId: org.services.psychology })))).rejects.toThrow("errors.serviceRole");
  });

  it("psychological assessments are restricted from other clinicians", async () => {
    const id = await withOrg(ctx(), (tx) =>
      createAssessment(tx, org.actors.psych, assessment({ assessorRole: "psychologist", serviceId: org.services.psychology })),
    );
    const list = await withOrg(ctx(), (tx) => listAssessments(tx, org.actors.speech, childId));
    const row = list.find((r) => r.id === id)!;
    expect(row.hidden).toBe(true);
    expect(row.toolName).toBeNull();
    await expect(withOrg(ctx(), (tx) => getAssessment(tx, org.actors.speech, id))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(withOrg(ctx(), (tx) => getAssessment(tx, org.actors.coordinator, id))).resolves.toMatchObject({ isRestricted: true });
    await expect(withOrg(ctx(), (tx) => listAssessments(tx, org.actors.admin, childId))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

let goalId: string;

describe("individual development plans", () => {
  it("creates a plan with measurable goals and keeps revision history", async () => {
    const planId = await withOrg(ctx(), (tx) => createPlan(tx, org.actors.speech, { childId, title: "Test IDP", startDate: isoDateIST(), reviewDate: addDays(isoDateIST(), 90), familyPriorities: "" }));
    await expect(withOrg(ctx(), (tx) => setPlanStatus(tx, org.actors.speech, planId, "active"))).rejects.toBeInstanceOf(ForbiddenError);
    await withOrg(ctx(), (tx) => setPlanStatus(tx, org.actors.coordinator, planId, "active"));
    const goal = {
      planId,
      domain: "expressive_language" as const,
      serviceId: org.services.speech_therapy,
      title: "Two-word requests",
      baseline: "1/10 (test)",
      target: "8/10 across 3 sessions",
      measurementMethod: "Trial data",
      targetPercent: "80",
      strategies: "Modelling",
      responsibleStaffId: org.actors.speech.staffId,
      reviewDate: addDays(isoDateIST(), 60),
      status: "in_progress" as const,
    };
    await expect(withOrg(ctx(), (tx) => addGoal(tx, org.actors.speech, { ...goal, responsibleStaffId: org.actors.ot.staffId }))).rejects.toThrow("errors.assigneeNotOnTeam");
    goalId = await withOrg(ctx(), (tx) => addGoal(tx, org.actors.speech, goal));
    // Another therapist on the team cannot change a goal they are not responsible for.
    const { planId: _p, ...fields } = goal;
    await expect(withOrg(ctx(), (tx) => reviseGoal(tx, org.actors.speech2, { ...fields, goalId, revisionReason: "x" }))).rejects.toThrow("errors.notYourRecord");
    const v2 = await withOrg(ctx(), (tx) => reviseGoal(tx, org.actors.speech, { ...fields, goalId, target: "9/10", revisionReason: "Baseline re-measured" }));
    expect(v2.version).toBe(2);
    const err = await withOrg(ctx(), (tx) => tx.update(schema.developmentGoals).set({ title: "tamper" }).where(eq(schema.developmentGoals.id, goalId))).catch((e) => e);
    expect(toActionError(err).error).toBe("errors.recordLocked");
    goalId = v2.id;
    await withOrg(ctx(), (tx) => reviewGoal(tx, org.actors.speech, { goalId, reviewedOn: isoDateIST(), statusAfter: "in_progress", summary: "Reviewed (test)" }));
    const plans = await withOrg(ctx(), (tx) => getPlans(tx, org.actors.speech, childId));
    expect(plans[0].goals).toHaveLength(1);
    expect(plans[0].goals[0].history).toHaveLength(1);
    expect(plans[0].goals[0].reviews).toHaveLength(1);
  });
});

describe("appointments and sessions", () => {
  let appointmentId: string;
  let sessionId: string;

  it("schedules, prevents double booking and enforces role/team/consent rules", async () => {
    const base = { childId, serviceId: org.services.speech_therapy, staffId: org.actors.speech.staffId, start: futureSlot(3), durationMinutes: "45", room: "", adminNotes: "", repeatWeeks: "1" };
    const ids = await withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, base));
    expect(ids).toHaveLength(2);
    appointmentId = ids[0];
    const dbl = await withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, { ...base, repeatWeeks: "0", start: futureSlot(3, "10:30") })).catch((e) => e);
    expect(toActionError(dbl).error).toBe("errors.staffDoubleBooked");
    const childClash = await withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, { ...base, staffId: org.actors.speech2.staffId, repeatWeeks: "0", start: futureSlot(3, "10:15") })).catch((e) => e);
    expect(toActionError(childClash).error).toBe("errors.childDoubleBooked");
    await expect(withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, { ...base, serviceId: org.services.psychology, repeatWeeks: "0", start: futureSlot(5) }))).rejects.toThrow("errors.serviceRole");
    await expect(withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, { ...base, staffId: org.actors.ot.staffId, serviceId: org.services.occupational_therapy, repeatWeeks: "0", start: futureSlot(6) }))).rejects.toThrow("errors.assigneeNotOnTeam");
    // A therapist may only schedule their own appointments.
    await expect(withOrg(ctx(), (tx) => createAppointments(tx, org.actors.speech2, { ...base, repeatWeeks: "0", start: futureSlot(7) }))).rejects.toBeInstanceOf(ForbiddenError);
    // Cancelled slots free up the time.
    await withOrg(ctx(), (tx) => cancelAppointment(tx, org.actors.admin, ids[1], "Family travel (test)", "cancelled_by_family"));
  });

  it("requires therapy consent", async () => {
    const { id: other } = await withOrg(ctx(), (tx) => registerChild(tx, org.actors.admin, childInput("No Consent Child")));
    await assign(org, other, "speech", "speech_therapy");
    await expect(
      withOrg(ctx(), (tx) => createAppointments(tx, org.actors.admin, { childId: other, serviceId: org.services.speech_therapy, staffId: org.actors.speech.staffId, start: futureSlot(9), durationMinutes: "45", room: "", adminNotes: "", repeatWeeks: "0" })),
    ).rejects.toThrow("errors.consentRequired");
  });

  it("only the assigned therapist can run and document the session", async () => {
    await expect(withOrg(ctx(), (tx) => startSession(tx, org.actors.speech2, appointmentId))).rejects.toThrow("errors.notYourRecord");
    sessionId = await withOrg(ctx(), (tx) => startSession(tx, org.actors.speech, appointmentId));
    const note = {
      sessionId,
      attendance: "present" as const,
      activitiesCompleted: "Snack-time requests (test)",
      childResponse: "Engaged",
      overallAssistance: "verbal_prompt" as const,
      followUp: "",
      parentParticipation: "",
      homeActivitySuggestion: "",
      workflow: { expressive: "Used 'more juice' twice", notAField: "dropped" },
      goals: [{ goalId, addressed: true, note: "", trialsTotal: "10", trialsSuccessful: "4", independentTrials: "1", assistanceLevel: "verbal_prompt" as const }],
    };
    await expect(withOrg(ctx(), (tx) => saveSessionNote(tx, org.actors.speech2, note))).rejects.toThrow("errors.notYourRecord");
    await withOrg(ctx(), (tx) => saveSessionNote(tx, org.actors.speech, note));
    const s = await withOrg(ctx(), (tx) => getSession(tx, org.actors.speech, sessionId));
    expect(s.workflowData).toEqual({ expressive: "Used 'more juice' twice" });
    expect(s.observations).toHaveLength(1);
    // Re-saving replaces (does not duplicate) measurements.
    await withOrg(ctx(), (tx) => saveSessionNote(tx, org.actors.speech, note));
    expect((await withOrg(ctx(), (tx) => getSession(tx, org.actors.speech, sessionId))).observations).toHaveLength(1);
    await expect(withOrg(ctx(), (tx) => signSession(tx, org.actors.speech, sessionId))).rejects.toThrow("errors.invalidStatus");
    await withOrg(ctx(), (tx) => completeSession(tx, org.actors.speech, sessionId));
    const [appt] = await owner.select().from(schema.appointments).where(eq(schema.appointments.id, appointmentId));
    expect(appt.status).toBe("completed");
    await withOrg(ctx(), (tx) => signSession(tx, org.actors.speech, sessionId));
    await expect(withOrg(ctx(), (tx) => saveSessionNote(tx, org.actors.speech, note))).rejects.toThrow("errors.recordLocked");
    const err = await withOrg(ctx(), (tx) => tx.delete(schema.goalObservations).where(eq(schema.goalObservations.sessionId, sessionId))).catch((e) => e);
    expect(toActionError(err).error).toBe("errors.recordLocked");
  });

  it("progress uses only recorded observations across goal versions", async () => {
    const progress = await withOrg(ctx(), (tx) => getGoalProgress(tx, org.actors.speech, childId));
    expect(progress[0].points).toEqual([expect.objectContaining({ rate: 40, independent: 10 })]);
    expect(progress[0].trend).toBe("insufficient");
    const summary = await withOrg(ctx(), (tx) => periodSummary(tx, childId, addDays(isoDateIST(), -1), addDays(isoDateIST(), 30)));
    expect(summary).toMatchObject({ attended: 1, missed: 1, goalsWorkedOn: 1, observations: 1 });
  });
});

describe("reports and approval", () => {
  it("requires four-eyes approval and portal consent before sharing", async () => {
    const draftId = await withOrg(ctx(), (tx) => createSummaryDraft(tx, org.actors.speech, childId, addDays(isoDateIST(), -1), addDays(isoDateIST(), 30)));
    const reports = await withOrg(ctx(), (tx) => listReports(tx, org.actors.speech, childId));
    const draft = reports.find((r) => r.id === draftId)!;
    expect(draft.content).toContain("Sessions attended: 1");
    expect(draft.content.replace(/\[[^\]]*\]/g, "")).not.toMatch(/improv|progress(ed)? well|better/i);
    await withOrg(ctx(), (tx) => transitionReport(tx, org.actors.speech, draftId, "pending_approval"));
    await expect(withOrg(ctx(), (tx) => transitionReport(tx, org.actors.speech, draftId, "approved"))).rejects.toThrow("errors.invalidStatus");
    await withOrg(ctx(), (tx) => transitionReport(tx, org.actors.coordinator, draftId, "approved"));
    await expect(withOrg(ctx(), (tx) => transitionReport(tx, org.actors.coordinator, draftId, "shared"))).rejects.toThrow("communication.shareNeedsConsent");
    await grantConsent(org, childId, "parent_portal");
    await withOrg(ctx(), (tx) => transitionReport(tx, org.actors.coordinator, draftId, "shared"));
  });

  it("only psychologists author psychological reports", async () => {
    const r = { childId, reportType: "psychological_report" as const, title: "Psych", periodStart: "", periodEnd: "", content: "Test", contentTe: "", teReviewed: false };
    await expect(withOrg(ctx(), (tx) => saveReport(tx, org.actors.speech, r))).rejects.toBeInstanceOf(AppError);
    const id = await withOrg(ctx(), (tx) => saveReport(tx, org.actors.psych, r));
    const list = await withOrg(ctx(), (tx) => listReports(tx, org.actors.speech, childId));
    expect(list.find((x) => x.id === id)).toMatchObject({ hidden: true, content: "" });
  });
});

describe("AI drafting safeguards", () => {
  it("de-identifies input, logs a pending-review draft and never edits records", async () => {
    const before = await owner.select().from(schema.therapySessions);
    const res = await withOrg(ctx(), (tx) => generateDraft(tx, org.actors.speech, { feature: "session_note_draft", text: "Clinical Child said juice. Mother phone 9876543210.", childId }));
    expect(res.provider).toBe("mock");
    expect(res.redactedInput).not.toContain("Clinical Child");
    expect(res.redactedInput).not.toContain("9876543210");
    expect(res.consentUsed).toBe(false);
    const [draft] = await owner.select().from(schema.aiDrafts).where(eq(schema.aiDrafts.id, res.id));
    expect(draft.status).toBe("pending_review");
    expect(draft.promptRedacted).not.toContain("Clinical");
    expect(await owner.select().from(schema.therapySessions)).toHaveLength(before.length);
  });
});
