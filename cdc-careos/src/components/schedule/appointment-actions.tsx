"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, LogIn, Play, UserX, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useT } from "@/i18n/client";
import { cancelAppointmentAction, checkInAction, noShowAction, startSessionAction } from "@/server/actions/scheduling";

export function AppointmentActions({
  id,
  status,
  sessionId,
  isMine,
  canManage,
  canDocument,
}: {
  id: string;
  status: string;
  sessionId: string | null;
  isMine: boolean;
  canManage: boolean;
  canDocument: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [by, setBy] = useState<"cancelled_by_family" | "cancelled_by_center">("cancelled_by_family");
  const open = ["scheduled", "checked_in"].includes(status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: unknown }>, after?: (d: unknown) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(t(res.error ?? "errors.unexpected"));
      if (res.message) toast.success(t(res.message));
      after?.(res.data);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-1.5">
      {sessionId && (isMine || canDocument) && (
        <Button asChild size="sm" variant="secondary"><Link href={`/sessions/${sessionId}`}><FileText /> {t("schedule.openSession")}</Link></Button>
      )}
      {open && status === "scheduled" && (isMine || canManage) && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => checkInAction(id))}><LogIn /> {t("schedule.checkIn")}</Button>
      )}
      {open && isMine && canDocument && !sessionId && (
        <Button
          size="sm"
          variant="accent"
          disabled={pending}
          onClick={() => run(() => startSessionAction(id), (d) => router.push(`/sessions/${(d as { sessionId: string }).sessionId}`))}
        >
          <Play /> {t("schedule.startSession")}
        </Button>
      )}
      {open && (isMine || canManage) && !sessionId && (
        <>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => noShowAction(id))}><UserX /> {t("schedule.markNoShow")}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setCancelOpen(true)}><CalendarX /> {t("common.cancel")}</Button>
        </>
      )}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title={t("schedule.cancel")}>
          <div className="space-y-4">
            <FormField label={t("schedule.attendance")} htmlFor="cx-by">
              <Select id="cx-by" value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
                <option value="cancelled_by_family">{t("enum.attendance.cancelled_by_family")}</option>
                <option value="cancelled_by_center">{t("enum.attendance.cancelled_by_center")}</option>
              </Select>
            </FormField>
            <FormField label={t("schedule.cancelReason")} htmlFor="cx-reason" required>
              <Textarea id="cx-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("common.close")}</Button>
              <Button
                variant="danger"
                disabled={!reason.trim()}
                loading={pending}
                onClick={() => run(() => cancelAppointmentAction({ appointmentId: id, reason, by }), () => setCancelOpen(false))}
              >
                {t("schedule.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
