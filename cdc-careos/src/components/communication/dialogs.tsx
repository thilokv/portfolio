"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, FilePlus2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { REPORT_TYPES } from "@/lib/constants";
import { messageSchema, reportSchema, type MessageInput, type ReportInput } from "@/lib/validation/communication";
import { saveReportAction, sendMessageAction } from "@/server/actions/communication";

export function NewMessageDialog({ childId, defaultBody = "" }: { childId: string; defaultBody?: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<MessageInput>({
    schema: messageSchema,
    defaultValues: { childId, kind: "update", subject: "", body: defaultBody, bodyTe: "", teReviewed: false },
    action: sendMessageAction,
    successMessage: "communication.sent",
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="accent"><MessageSquarePlus /> {t("communication.newMessage")}</Button></DialogTrigger>
      <DialogContent title={t("communication.newMessage")} className="sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("communication.kind")} htmlFor="m-kind">
              <Select id="m-kind" {...form.register("kind")}>
                <option value="update">{t("enum.messageKind.update")}</option>
                <option value="home_activity">{t("enum.messageKind.home_activity")}</option>
              </Select>
            </FormField>
            <FormField label={t("communication.subject")} htmlFor="m-subj" required error={err("subject")}>
              <Input id="m-subj" {...form.register("subject")} />
            </FormField>
          </div>
          <FormField label={t("communication.body")} htmlFor="m-body" required error={err("body")}>
            <Textarea id="m-body" rows={4} {...form.register("body")} />
          </FormField>
          <FormField label={t("communication.bodyTe")} htmlFor="m-te" error={err("bodyTe")}>
            <Textarea id="m-te" rows={4} lang="te" {...form.register("bodyTe")} />
          </FormField>
          <Alert tone="warning">{t("communication.teReviewHint")}</Alert>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox {...form.register("teReviewed")} /> {t("communication.teReviewed")}
          </label>
          {err("teReviewed") && <p className="text-xs font-medium text-danger-600">{t(err("teReviewed")!)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.submit")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ initial, canPsych, mode }: { initial: ReportInput; canPsych: boolean; mode: "new" | "edit" }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<ReportInput, { id: string }>({
    schema: reportSchema,
    defaultValues: initial,
    action: saveReportAction,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "new" ? (
          <Button size="sm" variant="secondary"><FilePlus2 /> {t("communication.newReport")}</Button>
        ) : (
          <Button size="sm" variant="ghost"><Pencil /> {t("common.edit")}</Button>
        )}
      </DialogTrigger>
      <DialogContent title={mode === "new" ? t("communication.newReport") : t("common.edit")} className="sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("communication.reportTitle")} htmlFor="r-title" required error={err("title")} className="sm:col-span-2">
              <Input id="r-title" {...form.register("title")} />
            </FormField>
            <FormField label={t("communication.reportType")} htmlFor="r-type">
              <Select id="r-type" {...form.register("reportType")}>
                {REPORT_TYPES.filter((r) => canPsych || r !== "psychological_report").map((r) => <option key={r} value={r}>{t(`enum.reportType.${r}`)}</option>)}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label={t("communication.periodStart")} htmlFor="r-from" error={err("periodStart")}>
                <Input id="r-from" type="date" {...form.register("periodStart")} />
              </FormField>
              <FormField label={t("communication.periodEnd")} htmlFor="r-to" error={err("periodEnd")}>
                <Input id="r-to" type="date" {...form.register("periodEnd")} />
              </FormField>
            </div>
          </div>
          <FormField label={t("communication.content")} htmlFor="r-content" required error={err("content")}>
            <Textarea id="r-content" rows={10} {...form.register("content")} />
          </FormField>
          <FormField label={t("communication.contentTe")} htmlFor="r-te" error={err("contentTe")}>
            <Textarea id="r-te" rows={6} lang="te" {...form.register("contentTe")} />
          </FormField>
          <Alert tone="warning">{t("communication.teReviewHint")}</Alert>
          <label className="flex items-center gap-2 text-sm"><Checkbox {...form.register("teReviewed")} /> {t("communication.teReviewed")}</label>
          {err("teReviewed") && <p className="text-xs font-medium text-danger-600">{t(err("teReviewed")!)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
