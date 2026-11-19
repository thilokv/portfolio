"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useT } from "@/i18n/client";
import { assignStaffAction, removeFromCareTeamAction } from "@/server/actions/children";

interface Member { id: string; staffName: string; serviceCode: string | null; isLead: boolean }

export function CareTeam({
  childId,
  team,
  canManage,
  staffOptions,
  serviceOptions,
}: {
  childId: string;
  team: Member[];
  canManage: boolean;
  staffOptions: { id: string; fullName: string; roles: string[] }[];
  serviceOptions: { id: string; code: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [isLead, setIsLead] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await assignStaffAction({ childId, staffId, serviceId, isLead });
      if (!res.ok) return void toast.error(t(res.error));
      toast.success(t("common.saved"));
      setOpen(false);
      setStaffId("");
      router.refresh();
    });
  const remove = (assignmentId: string) =>
    start(async () => {
      const res = await removeFromCareTeamAction({ assignmentId, childId });
      if (!res.ok) return void toast.error(t(res.error));
      router.refresh();
    });

  return (
    <div>
      {team.length === 0 ? (
        <p className="text-sm text-muted">{t("children.noCareTeam")}</p>
      ) : (
        <ul className="space-y-2">
          {team.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.staffName} className="size-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{m.staffName}</p>
                <p className="truncate text-xs text-muted">{m.serviceCode ? t(`enum.service.${m.serviceCode}`) : "—"}</p>
              </div>
              {m.isLead && <Badge tone="teal">{t("children.lead")}</Badge>}
              {canManage && (
                <button type="button" onClick={() => remove(m.id)} disabled={pending} className="rounded-lg p-1.5 text-navy-300 hover:bg-danger-50 hover:text-danger-600" aria-label={`${t("children.removeFromTeam")}: ${m.staffName}`}>
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="mt-4"><UserPlus /> {t("children.assignStaff")}</Button>
          </DialogTrigger>
          <DialogContent title={t("children.assignStaff")}>
            <div className="space-y-4">
              <FormField label={t("schedule.therapist")} htmlFor="ct-staff" required>
                <Select id="ct-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">—</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} — {s.roles.map((r) => t(`enum.role.${r}`)).join(", ")}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("schedule.service")} htmlFor="ct-service">
                <Select id="ct-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">—</option>
                  {serviceOptions.map((s) => (
                    <option key={s.id} value={s.id}>{t(`enum.service.${s.code}`)}</option>
                  ))}
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={isLead} onChange={(e) => setIsLead(e.target.checked)} /> {t("children.lead")}</label>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={submit} disabled={!staffId} loading={pending}>{t("children.assign")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
