"use server";
import { revalidatePath } from "next/cache";
import { withOrg } from "@/db";
import { assessmentSchema } from "@/lib/validation/assessments";
import { uuid } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { createAssessment, finalizeAssessment, updateAssessment } from "../services/assessments";

export async function saveAssessmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(assessmentSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    const id = await withOrg(staffCtx(actor), async (tx) => {
      if (data.id) {
        await updateAssessment(tx, actor, data.id, data);
        return data.id;
      }
      return createAssessment(tx, actor, data);
    });
    revalidatePath(`/children/${data.childId}/assessments`, "layout");
    return { ok: true, data: { id }, message: data.id ? "common.saved" : "assessments.created" };
  });
}

export async function finalizeAssessmentAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (aid) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => finalizeAssessment(tx, actor, aid));
    revalidatePath("/children", "layout");
    return { ok: true, message: "assessments.finalized" };
  });
}
