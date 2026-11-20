import { z } from "zod";
import { ASSISTANCE_LEVELS, ATTENDANCE_STATUSES } from "../constants";
import { intStrOpt, opt, req, uuid } from "./common";

const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const appointmentSchema = z.object({
  childId: uuid,
  serviceId: uuid,
  staffId: uuid,
  start: z.string().regex(LOCAL_DT, "validation.date"),
  durationMinutes: z.string().refine((v) => /^\d+$/.test(v) && +v >= 5 && +v <= 480, "validation.number"),
  room: opt(60),
  adminNotes: opt(1000),
  repeatWeeks: z.string().refine((v) => /^\d+$/.test(v) && +v >= 0 && +v <= 12, "validation.number"),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const cancelAppointmentSchema = z.object({
  appointmentId: uuid,
  reason: req(500),
  by: z.enum(["cancelled_by_family", "cancelled_by_center"]),
});

const assistanceOpt = z.union([z.enum(ASSISTANCE_LEVELS), z.literal("")]);

export const sessionGoalEntrySchema = z
  .object({
    goalId: uuid,
    addressed: z.boolean(),
    note: opt(2000),
    trialsTotal: intStrOpt(1, 500),
    trialsSuccessful: intStrOpt(0, 500),
    independentTrials: intStrOpt(0, 500),
    assistanceLevel: assistanceOpt,
  })
  .superRefine((v, ctx) => {
    if (!v.addressed) return;
    const tt = v.trialsTotal.trim();
    const ts = v.trialsSuccessful.trim();
    if ((tt === "") !== (ts === "")) ctx.addIssue({ code: "custom", path: ["trialsSuccessful"], message: "validation.trialsPair" });
    else if (tt !== "" && +ts > +tt) ctx.addIssue({ code: "custom", path: ["trialsSuccessful"], message: "validation.trials" });
    const ti = v.independentTrials.trim();
    if (ti !== "" && (ts === "" || +ti > +ts)) ctx.addIssue({ code: "custom", path: ["independentTrials"], message: "validation.independentTrials" });
  });

export const sessionNoteSchema = z.object({
  sessionId: uuid,
  attendance: z.enum(ATTENDANCE_STATUSES),
  activitiesCompleted: opt(),
  childResponse: opt(),
  overallAssistance: assistanceOpt,
  followUp: opt(),
  parentParticipation: opt(2000),
  homeActivitySuggestion: opt(2000),
  workflow: z.record(z.string().max(40), z.string().max(5000, "validation.tooLong")),
  goals: z.array(sessionGoalEntrySchema).max(30),
});
export type SessionNoteInput = z.infer<typeof sessionNoteSchema>;

export const sessionObservationSchema = z.object({ sessionId: uuid, category: req(40), observation: req(3000) });
