"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { useT } from "@/i18n/client";
import { ASSISTANCE_LEVELS } from "@/lib/constants";
import { isoDateIST } from "@/lib/dates";
import { observationSchema, type ObservationInput } from "@/lib/validation/progress";
import { createSummaryDraftAction, recordObservationAction } from "@/server/actions/communication";

export function RecordObservationDialog({ goalId }: { goalId: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<ObservationInput>({
    schema: observationSchema,
    defaultValues: { goalId, observedOn: isoDateIST(), trialsTotal: "", trialsSuccessful: "", independentTrials: "", assistanceLevel: "", note: "" },
    action: recordObservationAction,
    successMessage: "progress.observationSaved",
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> {t("progress.addObservation")}</Button></DialogTrigger>
      <DialogContent title={t("progress.addObservation")} description={t("sessions.measurementHelp")}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label={t("common.date")} htmlFor="o-date" required error={err("observedOn")}>
            <Input id="o-date" type="date" max={isoDateIST()} {...form.register("observedOn")} />
          </FormField>
          <FormField label={t("sessions.assistance")} htmlFor="o-al">
            <Select id="o-al" {...form.register("assistanceLevel")}>
              <option value="">{t("common.notRecorded")}</option>
              {ASSISTANCE_LEVELS.map((a) => <option key={a} value={a}>{t(`enum.assistance.${a}`)}</option>)}
            </Select>
          </FormField>
          <FormField label={t("sessions.trialsTotal")} htmlFor="o-tt" error={err("trialsTotal")}>
            <Input id="o-tt" inputMode="numeric" {...form.register("trialsTotal")} />
          </FormField>
          <FormField label={t("sessions.trialsSuccessful")} htmlFor="o-ts" error={err("trialsSuccessful")}>
            <Input id="o-ts" inputMode="numeric" {...form.register("trialsSuccessful")} />
          </FormField>
          <FormField label={t("sessions.independentTrials")} htmlFor="o-ti" error={err("independentTrials")}>
            <Input id="o-ti" inputMode="numeric" {...form.register("independentTrials")} />
          </FormField>
          <FormField label={t("common.notes")} htmlFor="o-note" error={err("note")} className="sm:col-span-2">
            <Textarea id="o-note" rows={2} {...form.register("note")} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateReportDraftButton({ childId, from, to }: { childId: string; from: string; to: string }) {
  const t = useT();
  return (
    <ConfirmActionButton
      label={t("progress.generateReport")}
      action={() => createSummaryDraftAction({ childId, from, to })}
      variant="secondary"
      icon={<FilePlus2 />}
      redirectTo={`/children/${childId}/communication`}
    />
  );
}
