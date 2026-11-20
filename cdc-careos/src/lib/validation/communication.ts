import { z } from "zod";
import { REPORT_TYPES } from "../constants";
import { dateOpt, opt, req, uuid } from "./common";

export const messageSchema = z
  .object({
    childId: uuid,
    kind: z.enum(["update", "home_activity"]),
    subject: req(200),
    body: req(5000),
    bodyTe: opt(5000),
    teReviewed: z.boolean(),
  })
  .refine((v) => !v.bodyTe.trim() || v.teReviewed, { path: ["teReviewed"], message: "validation.required" });
export type MessageInput = z.infer<typeof messageSchema>;

export const reportSchema = z
  .object({
    id: z.string().optional(),
    childId: uuid,
    reportType: z.enum(REPORT_TYPES),
    title: req(200),
    periodStart: dateOpt,
    periodEnd: dateOpt,
    content: req(20000),
    contentTe: opt(20000),
    teReviewed: z.boolean(),
  })
  .refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "validation.reviewAfterStart" })
  .refine((v) => !v.contentTe.trim() || v.teReviewed, { path: ["teReviewed"], message: "validation.required" });
export type ReportInput = z.infer<typeof reportSchema>;

export const reportTransitionSchema = z.object({ reportId: uuid, to: z.enum(["pending_approval", "approved", "shared", "withdrawn"]) });

export const feedbackSchema = z.object({ childId: uuid, subject: req(200), body: req(3000) });
export const contactUpdateSchema = z.object({
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "validation.phone"),
  alternatePhone: z.string().trim().refine((v) => v === "" || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v), "validation.phone"),
  address: opt(500),
  preferredLanguage: z.enum(["te", "en", "hi", "ur", "other"]),
});
