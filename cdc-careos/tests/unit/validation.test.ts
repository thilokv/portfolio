import { describe, expect, it } from "vitest";
import { registerChildSchema } from "@/lib/validation/children";
import { sessionGoalEntrySchema } from "@/lib/validation/scheduling";
import { passwordSchema } from "@/lib/validation/auth";
import { planSchema } from "@/lib/validation/plans";
import { addDays, isoDateIST } from "@/lib/dates";

const base = {
  fullName: "Test Child",
  preferredName: "",
  dateOfBirth: addDays(isoDateIST(), -800),
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
  guardian: { fullName: "Parent", phone: "9876543210", alternatePhone: "", email: "", relationship: "mother" as const, preferredLanguage: "te" as const },
  consentRegistration: true,
};

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]));

describe("child registration validation", () => {
  it("accepts a valid registration", () => {
    expect(registerChildSchema.safeParse(base).success).toBe(true);
  });
  it("requires recorded registration consent", () => {
    expect(issues(registerChildSchema.safeParse({ ...base, consentRegistration: false }))).toHaveProperty("consentRegistration");
  });
  it("rejects future or out-of-range dates of birth", () => {
    expect(issues(registerChildSchema.safeParse({ ...base, dateOfBirth: addDays(isoDateIST(), 3) }))["dateOfBirth"]).toBe("validation.dobRange");
    expect(issues(registerChildSchema.safeParse({ ...base, dateOfBirth: "2010-01-01" }))["dateOfBirth"]).toBe("validation.dobRange");
    expect(issues(registerChildSchema.safeParse({ ...base, dateOfBirth: "2024-02-31" }))["dateOfBirth"]).toBe("validation.date");
  });
  it("validates Indian mobile numbers", () => {
    expect(issues(registerChildSchema.safeParse({ ...base, guardian: { ...base.guardian, phone: "12345" } }))["guardian.phone"]).toBe("validation.phone");
    expect(registerChildSchema.safeParse({ ...base, guardian: { ...base.guardian, phone: "+91 9876543210" } }).success).toBe(true);
  });
});

describe("session measurement validation", () => {
  const g = { goalId: "00000000-0000-4000-8000-000000000000", addressed: true, note: "", trialsTotal: "", trialsSuccessful: "", independentTrials: "", assistanceLevel: "" as const };
  it("allows no trial data at all (missing is not zero)", () => {
    expect(sessionGoalEntrySchema.safeParse(g).success).toBe(true);
  });
  it("requires both trial counts together", () => {
    expect(issues(sessionGoalEntrySchema.safeParse({ ...g, trialsTotal: "10" }))["trialsSuccessful"]).toBe("validation.trialsPair");
  });
  it("rejects successes greater than trials", () => {
    expect(issues(sessionGoalEntrySchema.safeParse({ ...g, trialsTotal: "5", trialsSuccessful: "6" }))["trialsSuccessful"]).toBe("validation.trials");
  });
  it("rejects independent trials greater than successes", () => {
    expect(issues(sessionGoalEntrySchema.safeParse({ ...g, trialsTotal: "5", trialsSuccessful: "3", independentTrials: "4" }))["independentTrials"]).toBe("validation.independentTrials");
  });
});

describe("other validation", () => {
  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletterspassword").success).toBe(false);
    expect(passwordSchema.safeParse("Longer-pass-2026").success).toBe(true);
  });
  it("requires plan review date on/after start date", () => {
    const r = planSchema.safeParse({ childId: "00000000-0000-4000-8000-000000000000", title: "P", startDate: "2026-05-02", reviewDate: "2026-05-01", familyPriorities: "" });
    expect(issues(r)["reviewDate"]).toBe("validation.reviewAfterStart");
  });
});
