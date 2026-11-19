"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import {
  addGuardianSchema,
  archiveChildSchema,
  careTeamSchema,
  consentSchema,
  registerChildSchema,
  updateChildSchema,
} from "@/lib/validation/children";
import { uuid } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import {
  addGuardian,
  archiveChild,
  assignStaff,
  enableGuardianPortal,
  recordConsent,
  registerChild,
  removeFromCareTeam,
  restoreChild,
  updateChild,
} from "../services/children";

export async function registerChildAction(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction(registerChildSchema, input, async (data) => {
    const actor = await requireStaff("children.register");
    const res = await withOrg(staffCtx(actor), (tx) => registerChild(tx, actor, data));
    revalidatePath("/children");
    return { ok: true, data: res };
  });
}

export async function updateChildAction(input: unknown): Promise<ActionResult> {
  return runAction(updateChildSchema, input, async (data) => {
    const actor = await requireStaff("children.edit");
    await withOrg(staffCtx(actor), (tx) => updateChild(tx, actor, data));
    revalidatePath(`/children/${data.id}`, "layout");
    return { ok: true, message: "children.updated" };
  });
}

export async function archiveChildAction(input: unknown): Promise<ActionResult> {
  return runAction(archiveChildSchema, input, async ({ id, reason }) => {
    const actor = await requireStaff("children.archive");
    await withOrg(staffCtx(actor), (tx) => archiveChild(tx, actor, id, reason));
    revalidatePath(`/children/${id}`, "layout");
    return { ok: true, message: "children.archived" };
  });
}

export async function restoreChildAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (childId) => {
    const actor = await requireStaff("children.archive");
    await withOrg(staffCtx(actor), (tx) => restoreChild(tx, actor, childId));
    revalidatePath(`/children/${childId}`, "layout");
    return { ok: true, message: "children.restored" };
  });
}

export async function addGuardianAction(input: unknown): Promise<ActionResult> {
  return runAction(addGuardianSchema, input, async (data) => {
    const actor = await requireStaff("children.edit");
    await withOrg(staffCtx(actor), (tx) => addGuardian(tx, actor, data.childId, data));
    revalidatePath(`/children/${data.childId}`, "layout");
    return { ok: true, message: "children.guardianAdded" };
  });
}

export async function recordConsentAction(input: unknown): Promise<ActionResult> {
  return runAction(consentSchema, input, async (data) => {
    const actor = await requireStaff("consent.manage");
    await withOrg(staffCtx(actor), (tx) => recordConsent(tx, actor, data));
    revalidatePath(`/children/${data.childId}`, "layout");
    return { ok: true, message: "children.consentRecorded" };
  });
}

export async function assignStaffAction(input: unknown): Promise<ActionResult> {
  return runAction(careTeamSchema, input, async (data) => {
    const actor = await requireStaff("care_team.manage");
    await withOrg(staffCtx(actor), (tx) => assignStaff(tx, actor, data));
    revalidatePath(`/children/${data.childId}`, "layout");
    return { ok: true, message: "common.saved" };
  });
}

export async function removeFromCareTeamAction(input: unknown): Promise<ActionResult> {
  return runAction(z.object({ assignmentId: uuid, childId: uuid }), input, async (data) => {
    const actor = await requireStaff("care_team.manage");
    await withOrg(staffCtx(actor), (tx) => removeFromCareTeam(tx, actor, data.assignmentId));
    revalidatePath(`/children/${data.childId}`, "layout");
    return { ok: true, message: "common.saved" };
  });
}

export async function enablePortalAction(input: unknown): Promise<ActionResult<{ password: string | null }>> {
  return runAction(z.object({ childId: uuid, guardianId: uuid }), input, async (data) => {
    const actor = await requireStaff("consent.manage");
    const res = await withOrg(staffCtx(actor), (tx) => enableGuardianPortal(tx, actor, data.childId, data.guardianId));
    revalidatePath(`/children/${data.childId}`, "layout");
    return { ok: true, data: res };
  });
}
