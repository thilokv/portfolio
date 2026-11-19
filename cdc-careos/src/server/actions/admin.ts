"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import { availabilitySchema, serviceUpdateSchema, staffSchema } from "@/lib/validation/admin";
import { uuid } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { runAction } from "../action";
import type { ActionResult } from "../errors";
import { createStaff, removeAvailability, resetStaffPassword, setAvailability, setStaffActive, updateService, updateStaff } from "../services/admin";

export async function saveStaffAction(input: unknown): Promise<ActionResult<{ password?: string }>> {
  return runAction(staffSchema, input, async (d) => {
    const actor = await requireStaff("staff.manage");
    const res = await withOrg(staffCtx(actor), async (tx) => {
      if (d.id) {
        await updateStaff(tx, actor, { ...d, id: d.id });
        return {};
      }
      const created = await createStaff(tx, actor, d);
      return { password: created.password };
    });
    revalidatePath("/admin/staff");
    return { ok: true, data: res, message: d.id ? "admin.staffUpdated" : undefined };
  });
}

export async function setStaffActiveAction(input: unknown): Promise<ActionResult> {
  return runAction(z.object({ staffId: uuid, active: z.boolean() }), input, async (d) => {
    const actor = await requireStaff("staff.manage");
    await withOrg(staffCtx(actor), (tx) => setStaffActive(tx, actor, d.staffId, d.active));
    revalidatePath("/admin/staff");
    return { ok: true, message: "admin.staffUpdated" };
  });
}

export async function resetStaffPasswordAction(staffId: string): Promise<ActionResult<{ password: string }>> {
  return runAction(uuid, staffId, async (id) => {
    const actor = await requireStaff("staff.manage");
    const password = await withOrg(staffCtx(actor), (tx) => resetStaffPassword(tx, actor, id));
    return { ok: true, data: { password } };
  });
}

export async function setAvailabilityAction(input: unknown): Promise<ActionResult> {
  return runAction(availabilitySchema, input, async (d) => {
    const actor = await requireStaff("staff.manage");
    await withOrg(staffCtx(actor), (tx) => setAvailability(tx, actor, d));
    revalidatePath("/admin/staff");
    revalidatePath("/dashboard");
    return { ok: true, message: "admin.availabilitySaved" };
  });
}

export async function removeAvailabilityAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (aid) => {
    const actor = await requireStaff("staff.manage");
    await withOrg(staffCtx(actor), (tx) => removeAvailability(tx, actor, aid));
    revalidatePath("/admin/staff");
    return { ok: true, message: "common.saved" };
  });
}

export async function updateServiceAction(input: unknown): Promise<ActionResult> {
  return runAction(serviceUpdateSchema, input, async (d) => {
    const actor = await requireStaff("services.manage");
    await withOrg(staffCtx(actor), (tx) => updateService(tx, actor, d));
    revalidatePath("/admin/services");
    return { ok: true, message: "admin.serviceUpdated" };
  });
}
