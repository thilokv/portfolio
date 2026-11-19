import { describe, expect, it } from "vitest";
import { canDeliverService, computeChildAccess, hasPermission, permissionsFor } from "@/lib/permissions";

describe("role permissions", () => {
  it("administrators manage staff but cannot write clinical records", () => {
    expect(hasPermission(["admin"], "staff.manage")).toBe(true);
    expect(hasPermission(["admin"], "clinical.write")).toBe(false);
    expect(hasPermission(["admin"], "restricted.view")).toBe(false);
  });

  it("therapists cannot manage staff or view all children", () => {
    for (const role of ["speech_therapist", "occupational_therapist", "special_educator", "physiotherapist", "behaviour_professional"] as const) {
      expect(hasPermission([role], "staff.manage")).toBe(false);
      expect(hasPermission([role], "children.view_all")).toBe(false);
      expect(hasPermission([role], "clinical.write")).toBe(true);
    }
  });

  it("combines permissions across multiple roles", () => {
    const perms = permissionsFor(["admin", "speech_therapist"]);
    expect(perms.has("staff.manage")).toBe(true);
    expect(perms.has("clinical.write")).toBe(true);
  });

  it("restricts service delivery to matching professions", () => {
    expect(canDeliverService(["speech_therapist"], "speech_therapy")).toBe(true);
    expect(canDeliverService(["speech_therapist"], "psychology")).toBe(false);
    expect(canDeliverService(["psychologist"], "psychology")).toBe(true);
    expect(canDeliverService(["special_educator"], "early_intervention")).toBe(true);
  });
});

describe("child-level access", () => {
  it("unassigned therapist has no access at all", () => {
    expect(computeChildAccess(["speech_therapist"], false).canView).toBe(false);
  });
  it("assigned therapist can view and write clinical records but not restricted ones", () => {
    const a = computeChildAccess(["speech_therapist"], true);
    expect(a).toMatchObject({ canView: true, canViewClinical: true, canWriteClinical: true, canViewRestricted: false, canEditProfile: false });
  });
  it("administrator sees demographics only", () => {
    const a = computeChildAccess(["admin"], false);
    expect(a).toMatchObject({ canView: true, canViewClinical: false, canWriteClinical: false, canEditProfile: true });
  });
  it("coordinator sees everything including restricted records", () => {
    const a = computeChildAccess(["clinical_coordinator"], false);
    expect(a).toMatchObject({ canView: true, canViewClinical: true, canViewRestricted: true });
  });
  it("psychologist sees restricted records only for assigned children", () => {
    expect(computeChildAccess(["psychologist"], true).canViewRestricted).toBe(true);
    expect(computeChildAccess(["psychologist"], false).canView).toBe(false);
  });
});
