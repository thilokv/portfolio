"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, KeyRound, Pencil, Power, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { AVAILABILITY_STATUSES, STAFF_ROLES } from "@/lib/constants";
import { isoDateIST } from "@/lib/dates";
import { availabilitySchema, staffSchema, type AvailabilityInput, type StaffInput } from "@/lib/validation/admin";
import { removeAvailabilityAction, resetStaffPasswordAction, saveStaffAction, setAvailabilityAction, setStaffActiveAction } from "@/server/actions/admin";

function TempPassword({ password, onClose, title }: { password: string | null; onClose: () => void; title: string }) {
  const t = useT();
  return (
    <Dialog open={!!password} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title}>
        <Alert tone="success">{t("admin.staffCreatedHint")}</Alert>
        <p className="mt-4 select-all rounded-xl bg-navy-50 p-3 text-center font-mono text-lg tracking-wider" data-testid="temp-password">{password}</p>
      </DialogContent>
    </Dialog>
  );
}

export function StaffFormDialog({ initial }: { initial?: StaffInput }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const { form, onSubmit, pending, err } = useActionForm<StaffInput, { password?: string }>({
    schema: staffSchema,
    defaultValues: initial ?? { fullName: "", email: "", phone: "", designation: "", qualifications: "", registrationNumber: "", roles: [] },
    action: saveStaffAction,
    onSuccess: ({ data }) => {
      setOpen(false);
      if (data?.password) setPassword(data.password);
      if (!initial) form.reset();
      router.refresh();
    },
  });
  const roles = form.watch("roles");
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {initial ? <Button size="sm" variant="ghost"><Pencil /> {t("common.edit")}</Button> : <Button variant="accent"><UserPlus /> {t("admin.newStaff")}</Button>}
        </DialogTrigger>
        <DialogContent title={initial ? t("common.edit") : t("admin.newStaff")} className="sm:max-w-2xl">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <FormField label={t("admin.fullName")} htmlFor="st-name" required error={err("fullName")}>
              <Input id="st-name" {...form.register("fullName")} />
            </FormField>
            <FormField label={t("admin.email")} htmlFor="st-email" required error={err("email")}>
              <Input id="st-email" type="email" {...form.register("email")} />
            </FormField>
            <FormField label={t("admin.phone")} htmlFor="st-phone" error={err("phone")}>
              <Input id="st-phone" type="tel" {...form.register("phone")} />
            </FormField>
            <FormField label={t("admin.designation")} htmlFor="st-des" error={err("designation")}>
              <Input id="st-des" {...form.register("designation")} />
            </FormField>
            <FormField label={t("admin.qualifications")} htmlFor="st-q" error={err("qualifications")}>
              <Input id="st-q" {...form.register("qualifications")} />
            </FormField>
            <FormField label={t("admin.registrationNumber")} htmlFor="st-reg" error={err("registrationNumber")}>
              <Input id="st-reg" {...form.register("registrationNumber")} />
            </FormField>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-navy-700">{t("admin.roles")} <span className="text-danger-600">*</span></legend>
              <p className="text-xs text-muted">{t("admin.rolesHint")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STAFF_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <Checkbox
                      checked={roles?.includes(r)}
                      onChange={(e) => form.setValue("roles", e.target.checked ? [...(roles ?? []), r] : (roles ?? []).filter((x) => x !== r), { shouldValidate: true })}
                    />
                    {t(`enum.role.${r}`)}
                  </label>
                ))}
              </div>
              {err("roles") && <p className="mt-1 text-xs font-medium text-danger-600">{t(err("roles")!)}</p>}
            </fieldset>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" loading={pending}>{t("common.save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <TempPassword password={password} onClose={() => setPassword(null)} title={t("admin.staffCreated", { password: "" }).replace(/:\s*$/, "")} />
    </>
  );
}

export function StaffRowActions({ staffId, active, isSelf }: { staffId: string; active: boolean; isSelf: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  return (
    <>
      {!isSelf && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
          const res = await setStaffActiveAction({ staffId, active: !active });
          if (!res.ok) return void toast.error(t(res.error));
          toast.success(t("admin.staffUpdated"));
          router.refresh();
        })}>
          <Power /> {active ? t("admin.deactivate") : t("admin.activate")}
        </Button>
      )}
      {active && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
          const res = await resetStaffPasswordAction(staffId);
          if (!res.ok) return void toast.error(t(res.error));
          setPassword(res.data?.password ?? null);
        })}>
          <KeyRound /> {t("admin.resetPassword")}
        </Button>
      )}
      <TempPassword password={password} onClose={() => setPassword(null)} title={t("admin.resetPassword")} />
    </>
  );
}

export function AvailabilityDialog({ staffId, entries }: { staffId: string; entries: { id: string; date: string; status: string; note: string | null }[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { form, onSubmit, pending: saving, err } = useActionForm<AvailabilityInput>({
    schema: availabilitySchema,
    defaultValues: { staffId, date: isoDateIST(), status: "leave", note: "" },
    action: setAvailabilityAction,
    successMessage: "admin.availabilitySaved",
    onSuccess: () => router.refresh(),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><CalendarOff /> {t("admin.availability")}</Button></DialogTrigger>
      <DialogContent title={t("admin.availability")}>
        {entries.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                <span>{e.date} · {t(`enum.availability.${e.status}`)}{e.note ? ` · ${e.note}` : ""}</span>
                <button className="text-navy-400 hover:text-danger-600" disabled={pending} aria-label={t("common.delete")} onClick={() => start(async () => { await removeAvailabilityAction(e.id); router.refresh(); })}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
          <FormField label={t("common.date")} htmlFor="av-date" required error={err("date")}>
            <Input id="av-date" type="date" {...form.register("date")} />
          </FormField>
          <FormField label={t("common.status")} htmlFor="av-status">
            <Select id="av-status" {...form.register("status")}>
              {AVAILABILITY_STATUSES.map((s) => <option key={s} value={s}>{t(`enum.availability.${s}`)}</option>)}
            </Select>
          </FormField>
          <FormField label={t("common.notes")} htmlFor="av-note" className="sm:col-span-2">
            <Input id="av-note" {...form.register("note")} />
          </FormField>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={saving}>{t("admin.addAvailability")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
