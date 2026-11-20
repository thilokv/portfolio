"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import { uuid, uuidOpt } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { consumeRateLimit, RULES } from "../auth/rate-limit";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { AI_FEATURES } from "../ai/providers";
import { generateDraft, reviewDraft } from "../services/ai";

const schema = z.object({ feature: z.enum(AI_FEATURES), text: z.string().trim().min(1, "validation.required").max(4000, "validation.tooLong"), childId: uuidOpt });

export async function generateDraftAction(input: unknown): Promise<ActionResult<{ id: string; output: string; provider: string; consentUsed: boolean; redactedInput: string }>> {
  return runAction(schema, input, async (d) => {
    const actor = await requireStaff("ai.use");
    if (!(await consumeRateLimit(RULES.ai, actor.userId))) return { ok: false, error: "auth.rateLimited" };
    const res = await withOrg(staffCtx(actor), (tx) => generateDraft(tx, actor, { feature: d.feature, text: d.text, childId: d.childId || undefined }));
    return { ok: true, data: res };
  });
}

export async function reviewDraftAction(input: unknown): Promise<ActionResult> {
  return runAction(z.object({ id: uuid, status: z.enum(["accepted", "discarded"]) }), input, async (d) => {
    const actor = await requireStaff("ai.use");
    await withOrg(staffCtx(actor), (tx) => reviewDraft(tx, actor, d.id, d.status));
    revalidatePath("/assistant");
    return { ok: true, message: d.status === "accepted" ? "ai.accepted" : "ai.discarded" };
  });
}
