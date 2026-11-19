"use server";
import { revalidatePath } from "next/cache";
import { withOrg } from "@/db";
import { contactUpdateSchema, feedbackSchema } from "@/lib/validation/communication";
import { guardianCtx, requireGuardian } from "../auth/actor";
import { consumeRateLimit, RULES } from "../auth/rate-limit";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { sendFeedback, updateContact } from "../services/portal";

export async function sendFeedbackAction(input: unknown): Promise<ActionResult> {
  return runAction(feedbackSchema, input, async (d) => {
    const actor = await requireGuardian();
    if (!(await consumeRateLimit(RULES.parentFeedback, actor.userId))) return { ok: false, error: "auth.rateLimited" };
    await withOrg(guardianCtx(actor), (tx) => sendFeedback(tx, actor, d));
    revalidatePath("/portal/messages");
    return { ok: true, message: "portal.feedbackSent" };
  });
}

export async function updateContactAction(input: unknown): Promise<ActionResult> {
  return runAction(contactUpdateSchema, input, async (d) => {
    const actor = await requireGuardian();
    await withOrg(guardianCtx(actor), (tx) => updateContact(tx, actor, d));
    revalidatePath("/portal/profile");
    return { ok: true, message: "portal.contactUpdated" };
  });
}
