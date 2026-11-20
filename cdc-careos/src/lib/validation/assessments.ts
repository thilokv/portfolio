import { z } from "zod";
import { DEVELOPMENTAL_DOMAINS, STAFF_ROLES } from "../constants";
import { isoDateIST } from "../dates";
import { dateOpt, dateReq, opt, req, uuid, uuidOpt } from "./common";

export const assessmentSchema = z
  .object({
    id: z.string().optional(),
    childId: uuid,
    serviceId: uuidOpt,
    assessorRole: z.enum(STAFF_ROLES),
    assessmentDate: dateReq.refine((v) => v <= isoDateIST(), "validation.dateFuture"),
    toolName: req(200),
    toolVersion: opt(100),
    reasonForAssessment: opt(2000),
    overallObservations: opt(),
    recommendations: opt(),
    reviewDate: dateOpt,
    isRestricted: z.boolean(),
    domains: z.array(z.object({ domain: z.enum(DEVELOPMENTAL_DOMAINS), findings: opt(), observations: opt() })).max(20),
  })
  .refine((v) => v.reviewDate === "" || v.reviewDate >= v.assessmentDate, { path: ["reviewDate"], message: "validation.reviewAfterStart" })
  .refine((v) => v.domains.some((d) => d.findings.trim() || d.observations.trim()), { path: ["domains"], message: "validation.atLeastOneDomain" });
export type AssessmentInput = z.infer<typeof assessmentSchema>;
