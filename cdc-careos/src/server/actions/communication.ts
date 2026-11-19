"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import { dateReq, uuid } from "@/lib/validation/common";
import { messageSchema, reportSchema, reportTransitionSchema } from "@/lib/validation/communication";
import { observationSchema } from "@/lib/validation/progress";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { acknowledgeMessage, createSummaryDraft, saveReport, sendMessage, transitionReport } from "../services/communication";
import { recordObservation } from "../services/progress";

const refresh = () => revalidatePath("/children", "layout");

export async function sendMessageAction(input: unknown): Promise<ActionResult> {
  return runAction(messageSchema, input, async (d) => {
    const actor = await requireStaff("messages.send");
    await withOrg(staffCtx(actor), (tx) => sendMessage(tx, actor, d));
    refresh();
    return { ok: true, message: "communication.sent" };
  });
}

export async function acknowledgeMessageAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (mid) => {
    const actor = await requireStaff("clinical.view");
    await withOrg(staffCtx(actor), (tx) => acknowledgeMessage(tx, actor, mid));
    refresh();
    return { ok: true, message: "communication.acknowledged" };
  });
}

export async function saveReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(reportSchema, input, async (d) => {
    const actor = await requireStaff("clinical.write");
    const id = await withOrg(staffCtx(actor), (tx) => saveReport(tx, actor, d));
    refresh();
    return { ok: true, data: { id }, message: d.id ? "communication.reportUpdated" : "communication.reportCreated" };
  });
}

export async function transitionReportAction(input: unknown): Promise<ActionResult> {
  return runAction(reportTransitionSchema, input, async (d) => {
    const actor = await requireStaff("clinical.view");
    await withOrg(staffCtx(actor), (tx) => transitionReport(tx, actor, d.reportId, d.to));
    refresh();
    return { ok: true, message: "communication.reportUpdated" };
  });
}

export async function createSummaryDraftAction(input: unknown): Promise<ActionResult> {
  return runAction(z.object({ childId: uuid, from: dateReq, to: dateReq }), input, async (d) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => createSummaryDraft(tx, actor, d.childId, d.from, d.to));
    refresh();
    return { ok: true, message: "progress.reportDraftCreated" };
  });
}

export async function recordObservationAction(input: unknown): Promise<ActionResult> {
  return runAction(observationSchema, input, async (d) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => recordObservation(tx, actor, d));
    refresh();
    return { ok: true, message: "progress.observationSaved" };
  });
}
