"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import { goalReviewSchema, goalSchema, planSchema, reviseGoalSchema } from "@/lib/validation/plans";
import { uuid } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { addGoal, createPlan, reviewGoal, reviseGoal, setPlanStatus } from "../services/plans";

const revalidate = () => revalidatePath("/children", "layout");

export async function createPlanAction(input: unknown): Promise<ActionResult> {
  return runAction(planSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => createPlan(tx, actor, data));
    revalidate();
    return { ok: true, message: "plans.created" };
  });
}

export async function setPlanStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(z.object({ planId: uuid, status: z.enum(["active", "closed", "under_review"]) }), input, async (data) => {
    const actor = await requireStaff("plans.approve");
    await withOrg(staffCtx(actor), (tx) => setPlanStatus(tx, actor, data.planId, data.status));
    revalidate();
    return { ok: true, message: data.status === "active" ? "plans.activated" : "common.saved" };
  });
}

export async function addGoalAction(input: unknown): Promise<ActionResult> {
  return runAction(goalSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => addGoal(tx, actor, data));
    revalidate();
    return { ok: true, message: "plans.goalCreated" };
  });
}

export async function reviseGoalAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction(reviseGoalSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    const row = await withOrg(staffCtx(actor), (tx) => reviseGoal(tx, actor, data));
    revalidate();
    return { ok: true, data: { version: row.version } };
  });
}

export async function reviewGoalAction(input: unknown): Promise<ActionResult> {
  return runAction(goalReviewSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => reviewGoal(tx, actor, data));
    revalidate();
    return { ok: true, message: "plans.reviewSaved" };
  });
}
