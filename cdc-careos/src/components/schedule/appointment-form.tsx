"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField, FormSection } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { SERVICE_ROLES, type ServiceCode, type StaffRole } from "@/lib/constants";
import { appointmentSchema, type AppointmentInput } from "@/lib/validation/scheduling";
import { createAppointmentAction } from "@/server/actions/scheduling";

interface ChildOpt {
  id: string;
  fullName: string;
  childCode: string;
  team: { staffId: string; staffName: string; serviceId: string | null; roles: string[] }[];
}

export function AppointmentForm({
  childrenOptions,
  services,
  defaults,
  restrictToStaffId,
}: {
  childrenOptions: ChildOpt[];
  services: { id: string; code: string; duration: number }[];
  defaults: Partial<AppointmentInput>;
  restrictToStaffId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<AppointmentInput, { count: number }>({
    schema: appointmentSchema,
    defaultValues: { childId: "", serviceId: "", staffId: "", start: "", durationMinutes: "45", room: "", adminNotes: "", repeatWeeks: "0", ...defaults },
    action: createAppointmentAction,
    onSuccess: ({ data }) => {
      toast.success(data && data.count > 1 ? t("schedule.createdMany", { n: data.count }) : t("schedule.created"));
      router.push(`/schedule?date=${form.getValues("start").slice(0, 10)}`);
      router.refresh();
    },
  });
  const childId = form.watch("childId");
  const staffId = form.watch("staffId");
  const child = childrenOptions.find((c) => c.id === childId);
  const team = (child?.team ?? []).filter((m) => !restrictToStaffId || m.staffId === restrictToStaffId);
  const uniqueTeam = [...new Map(team.map((m) => [m.staffId, m])).values()];
  const member = uniqueTeam.find((m) => m.staffId === staffId);
  const serviceOpts = useMemo(
    () => services.filter((s) => !member || member.roles.some((r) => SERVICE_ROLES[s.code as ServiceCode].includes(r as StaffRole))),
    [services, member],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormSection title={t("schedule.new")}>
        <FormField label={t("schedule.child")} htmlFor="a-child" required error={err("childId")} className="sm:col-span-2">
          <Select
            id="a-child"
            {...form.register("childId", {
              onChange: () => {
                form.setValue("staffId", "");
                form.setValue("serviceId", "");
              },
            })}
          >
            <option value="">—</option>
            {childrenOptions.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.childCode})</option>)}
          </Select>
        </FormField>
        <FormField label={t("schedule.therapist")} htmlFor="a-staff" required error={err("staffId")} hint={!childId ? t("schedule.selectChildFirst") : undefined}>
          <Select
            id="a-staff"
            disabled={!childId}
            {...form.register("staffId", {
              onChange: (e) => {
                const m = uniqueTeam.find((x) => x.staffId === e.target.value);
                const assigned = child?.team.find((x) => x.staffId === e.target.value && x.serviceId)?.serviceId;
                if (m && assigned) {
                  form.setValue("serviceId", assigned);
                  const svc = services.find((s) => s.id === assigned);
                  if (svc) form.setValue("durationMinutes", String(svc.duration));
                }
              },
            })}
          >
            <option value="">—</option>
            {uniqueTeam.map((m) => <option key={m.staffId} value={m.staffId}>{m.staffName}</option>)}
          </Select>
        </FormField>
        <FormField label={t("schedule.service")} htmlFor="a-service" required error={err("serviceId")}>
          <Select
            id="a-service"
            {...form.register("serviceId", {
              onChange: (e) => {
                const svc = services.find((s) => s.id === e.target.value);
                if (svc) form.setValue("durationMinutes", String(svc.duration));
              },
            })}
          >
            <option value="">—</option>
            {serviceOpts.map((s) => <option key={s.id} value={s.id}>{t(`enum.service.${s.code}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("schedule.start")} htmlFor="a-start" required error={err("start")}>
          <Input id="a-start" type="datetime-local" step={300} {...form.register("start")} />
        </FormField>
        <FormField label={t("schedule.duration")} htmlFor="a-dur" required error={err("durationMinutes")}>
          <Input id="a-dur" inputMode="numeric" {...form.register("durationMinutes")} />
        </FormField>
        <FormField label={t("schedule.room")} htmlFor="a-room" error={err("room")}>
          <Input id="a-room" {...form.register("room")} />
        </FormField>
        <FormField label={t("schedule.repeatWeekly")} htmlFor="a-repeat">
          <Select id="a-repeat" {...form.register("repeatWeeks")}>
            <option value="0">{t("schedule.doesNotRepeat")}</option>
            {[1, 3, 5, 7, 11].map((n) => <option key={n} value={String(n)}>{t("schedule.weeks", { n: n + 1 })}</option>)}
          </Select>
        </FormField>
        <FormField label={t("schedule.adminNotes")} htmlFor="a-notes" className="sm:col-span-2" error={err("adminNotes")}>
          <Textarea id="a-notes" rows={2} {...form.register("adminNotes")} />
        </FormField>
      </FormSection>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button type="submit" variant="accent" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
