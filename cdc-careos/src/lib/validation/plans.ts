import { z } from "zod";
import { DEVELOPMENTAL_DOMAINS, GOAL_STATUSES } from "../constants";
import { dateReq, intStrOpt, opt, req, uuid, uuidOpt } from "./common";

export const planSchema = z
  .object({ childId: uuid, title: req(200), startDate: dateReq, reviewDate: dateReq, familyPriorities: opt(3000) })
  .refine((v) => v.reviewDate >= v.startDate, { path: ["reviewDate"], message: "validation.reviewAfterStart" });
export type PlanInput = z.infer<typeof planSchema>;

const goalFields = {
  domain: z.enum(DEVELOPMENTAL_DOMAINS),
  serviceId: uuidOpt,
  title: req(300),
  baseline: req(3000),
  target: req(3000),
  measurementMethod: req(1000),
  targetPercent: intStrOpt(1, 100),
  strategies: req(3000),
  responsibleStaffId: uuid,
  reviewDate: dateReq,
  status: z.enum(GOAL_STATUSES),
};

export const goalSchema = z.object({ planId: uuid, ...goalFields });
export type GoalInput = z.infer<typeof goalSchema>;

export const reviseGoalSchema = z.object({ goalId: uuid, ...goalFields, revisionReason: req(1000) });
export type ReviseGoalInput = z.infer<typeof reviseGoalSchema>;

export const goalReviewSchema = z.object({ goalId: uuid, reviewedOn: dateReq, statusAfter: z.enum(GOAL_STATUSES), summary: req(3000) });
export type GoalReviewInput = z.infer<typeof goalReviewSchema>;
