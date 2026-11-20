"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withOrg } from "@/db";
import { uuid } from "@/lib/validation/common";
import { appointmentSchema, cancelAppointmentSchema, sessionNoteSchema, sessionObservationSchema } from "@/lib/validation/scheduling";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import {
  addSessionObservation,
  cancelAppointment,
  checkInAppointment,
  completeSession,
  createAppointments,
  markNoShow,
  saveSessionNote,
  signSession,
  startSession,
} from "../services/scheduling";

const refresh = () => {
  revalidatePath("/schedule");
  revalidatePath("/sessions", "layout");
  revalidatePath("/dashboard");
};

export async function createAppointmentAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(appointmentSchema, input, async (data) => {
    const actor = await requireStaff();
    const ids = await withOrg(staffCtx(actor), (tx) => createAppointments(tx, actor, data));
    refresh();
    return { ok: true, data: { count: ids.length } };
  });
}

export async function checkInAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (aid) => {
    const actor = await requireStaff();
    await withOrg(staffCtx(actor), (tx) => checkInAppointment(tx, actor, aid));
    refresh();
    return { ok: true, message: "schedule.checkedIn" };
  });
}

export async function cancelAppointmentAction(input: unknown): Promise<ActionResult> {
  return runAction(cancelAppointmentSchema, input, async (d) => {
    const actor = await requireStaff();
    await withOrg(staffCtx(actor), (tx) => cancelAppointment(tx, actor, d.appointmentId, d.reason, d.by));
    refresh();
    return { ok: true, message: "schedule.cancelled" };
  });
}

export async function noShowAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (aid) => {
    const actor = await requireStaff();
    await withOrg(staffCtx(actor), (tx) => markNoShow(tx, actor, aid));
    refresh();
    return { ok: true, message: "schedule.noShowMarked" };
  });
}

export async function startSessionAction(id: string): Promise<ActionResult<{ sessionId: string }>> {
  return runAction(uuid, id, async (aid) => {
    const actor = await requireStaff("clinical.write");
    const sessionId = await withOrg(staffCtx(actor), (tx) => startSession(tx, actor, aid));
    refresh();
    return { ok: true, data: { sessionId }, message: "sessions.started_ok" };
  });
}

/** Form-post variant used from the schedule list (works without client JS). */
export async function startSessionAndOpen(id: string): Promise<void> {
  const res = await startSessionAction(id);
  if (res.ok && res.data) redirect(`/sessions/${res.data.sessionId}`);
}

export async function saveSessionNoteAction(input: unknown): Promise<ActionResult> {
  return runAction(sessionNoteSchema, input, async (data) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => saveSessionNote(tx, actor, data));
    refresh();
    return { ok: true, message: "sessions.saved" };
  });
}

export async function addObservationAction(input: unknown): Promise<ActionResult> {
  return runAction(sessionObservationSchema, input, async (d) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => addSessionObservation(tx, actor, d.sessionId, d.category, d.observation));
    revalidatePath(`/sessions/${d.sessionId}`);
    return { ok: true, message: "common.saved" };
  });
}

export async function completeSessionAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (sid) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => completeSession(tx, actor, sid));
    refresh();
    return { ok: true, message: "sessions.completed" };
  });
}

export async function signSessionAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (sid) => {
    const actor = await requireStaff("clinical.write");
    await withOrg(staffCtx(actor), (tx) => signSession(tx, actor, sid));
    refresh();
    return { ok: true, message: "sessions.signed" };
  });
}
