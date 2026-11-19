import { z } from "zod";
import { CHILD_STATUSES, CONSENT_STATUSES, CONSENT_TYPES, LANGUAGES, RELATIONSHIPS } from "../constants";
import { isoDateIST, addDays } from "../dates";
import { dateReq, emailOpt, opt, phoneOpt, phoneReq, req, uuid, uuidOpt } from "./common";

export const SEX_VALUES = ["", "female", "male", "other", "undisclosed"] as const;

/** DOB must be in the past and the child at most 8 years old (center serves 0–7). */
export const dobSchema = dateReq.refine((v) => {
  const today = isoDateIST();
  return v <= today && v >= addDays(today, -366 * 8);
}, "validation.dobRange");

export const childProfileSchema = z.object({
  fullName: req(120),
  preferredName: opt(60),
  dateOfBirth: dobSchema,
  sex: z.enum(SEX_VALUES),
  preferredLanguage: z.enum(LANGUAGES),
  address: opt(500),
  emergencyContactName: opt(120),
  emergencyContactPhone: phoneOpt,
  emergencyContactRelation: opt(60),
  developmentalHistory: opt(),
  parentConcerns: opt(),
  medicalHistory: opt(),
  existingReportsSummary: opt(),
  referralSource: opt(200),
});
export type ChildProfileInput = z.infer<typeof childProfileSchema>;

export const guardianSchema = z.object({
  fullName: req(120),
  phone: phoneReq,
  alternatePhone: phoneOpt,
  email: emailOpt,
  relationship: z.enum(RELATIONSHIPS),
  preferredLanguage: z.enum(LANGUAGES),
});
export type GuardianInput = z.infer<typeof guardianSchema>;

export const registerChildSchema = childProfileSchema.extend({
  guardian: guardianSchema,
  consentRegistration: z.boolean().refine((v) => v === true, "validation.required"),
});
export type RegisterChildInput = z.infer<typeof registerChildSchema>;

export const updateChildSchema = childProfileSchema.extend({
  id: uuid,
  status: z.enum(["active", "waitlisted", "on_hold", "discharged"]),
});
export type UpdateChildInput = z.infer<typeof updateChildSchema>;

export const archiveChildSchema = z.object({ id: uuid, reason: req(500) });

export const addGuardianSchema = guardianSchema.extend({ childId: uuid, isPrimary: z.boolean() });

export const consentSchema = z.object({
  childId: uuid,
  consentType: z.enum(CONSENT_TYPES),
  status: z.enum(CONSENT_STATUSES),
  givenByGuardianId: uuidOpt,
  method: z.enum(["paper_form", "verbal", "portal"]),
  effectiveDate: dateReq,
  notes: opt(1000),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const careTeamSchema = z.object({ childId: uuid, staffId: uuid, serviceId: uuidOpt, isLead: z.boolean() });

export const childListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum([...CHILD_STATUSES, "all"]).optional(),
  service: z.string().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});
