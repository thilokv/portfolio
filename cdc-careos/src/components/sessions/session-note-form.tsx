"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSection } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { useT } from "@/i18n/client";
import { ASSISTANCE_LEVELS, ATTENDANCE_STATUSES, WORKFLOW_FIELDS, type ServiceCode } from "@/lib/constants";
import { sessionNoteSchema, type SessionNoteInput } from "@/lib/validation/scheduling";
import { addObservationAction, completeSessionAction, saveSessionNoteAction, signSessionAction } from "@/server/actions/scheduling";

export function SessionNoteForm({
  initial,
  serviceCode,
  goals,
  status,
}: {
  initial: SessionNoteInput;
  serviceCode: ServiceCode;
  goals: { id: string; title: string; domain: string; target: string }[];
  status: string;
}) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<SessionNoteInput>({
    schema: sessionNoteSchema,
    defaultValues: initial,
    action: saveSessionNoteAction,
    successMessage: "sessions.saved",
    onSuccess: () => router.refresh(),
  });
  const fields = WORKFLOW_FIELDS[serviceCode];
  const goalValues = form.watch("goals");
  const dirty = form.formState.isDirty;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert tone="info">{t("sessions.factsVsInterpretation")}</Alert>
      <FormSection title={t("sessions.noteTitle")}>
        <FormField label={t("sessions.attendance")} htmlFor="s-att" required>
          <Select id="s-att" {...form.register("attendance")}>
            {ATTENDANCE_STATUSES.map((a) => <option key={a} value={a}>{t(`enum.attendance.${a}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("sessions.overallAssistance")} htmlFor="s-assist">
          <Select id="s-assist" {...form.register("overallAssistance")}>
            <option value="">{t("common.notRecorded")}</option>
            {ASSISTANCE_LEVELS.map((a) => <option key={a} value={a}>{t(`enum.assistance.${a}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("sessions.activities")} htmlFor="s-act" className="sm:col-span-2" error={err("activitiesCompleted")}>
          <Textarea id="s-act" rows={3} {...form.register("activitiesCompleted")} />
        </FormField>
        <FormField label={t("sessions.childResponse")} htmlFor="s-resp" className="sm:col-span-2" error={err("childResponse")}>
          <Textarea id="s-resp" rows={3} {...form.register("childResponse")} />
        </FormField>
      </FormSection>

      <FormSection title={t("sessions.workflow", { service: t(`enum.service.${serviceCode}`) })}>
        {fields.map((f) => (
          <FormField key={f.key} label={t(f.label)} htmlFor={`wf-${f.key}`} hint={f.hint ? t(f.hint) : undefined} className="sm:col-span-2">
            <Textarea id={`wf-${f.key}`} rows={2} {...form.register(`workflow.${f.key}` as const)} />
          </FormField>
        ))}
      </FormSection>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">{t("sessions.goalsAddressed")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("sessions.measurementHelp")}</p>
        {goals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("sessions.noGoalsAvailable")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {goals.map((g, i) => {
              const on = goalValues?.[i]?.addressed;
              return (
                <li key={g.id} className={`rounded-xl border p-4 transition ${on ? "border-teal-200 bg-teal-50/40" : "border-line"}`}>
                  <label className="flex items-start gap-3">
                    <Checkbox className="mt-0.5" {...form.register(`goals.${i}.addressed` as const)} />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-teal-700">{t(`enum.domain.${g.domain}`)}</span>
                      <span className="block font-medium text-ink">{g.title}</span>
                      <span className="block text-xs text-muted">{g.target}</span>
                    </span>
                  </label>
                  {on && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <FormField label={t("sessions.trialsTotal")} htmlFor={`g${i}-tt`} error={err(`goals.${i}.trialsTotal` as never)}>
                        <Input id={`g${i}-tt`} inputMode="numeric" {...form.register(`goals.${i}.trialsTotal` as const)} />
                      </FormField>
                      <FormField label={t("sessions.trialsSuccessful")} htmlFor={`g${i}-ts`} error={err(`goals.${i}.trialsSuccessful` as never)}>
                        <Input id={`g${i}-ts`} inputMode="numeric" {...form.register(`goals.${i}.trialsSuccessful` as const)} />
                      </FormField>
                      <FormField label={t("sessions.independentTrials")} htmlFor={`g${i}-ti`} error={err(`goals.${i}.independentTrials` as never)}>
                        <Input id={`g${i}-ti`} inputMode="numeric" {...form.register(`goals.${i}.independentTrials` as const)} />
                      </FormField>
                      <FormField label={t("sessions.assistance")} htmlFor={`g${i}-al`}>
                        <Select id={`g${i}-al`} {...form.register(`goals.${i}.assistanceLevel` as const)}>
                          <option value="">{t("common.notRecorded")}</option>
                          {ASSISTANCE_LEVELS.map((a) => <option key={a} value={a}>{t(`enum.assistance.${a}`)}</option>)}
                        </Select>
                      </FormField>
                      <FormField label={t("sessions.goalNote")} htmlFor={`g${i}-n`} className="sm:col-span-4">
                        <Textarea id={`g${i}-n`} rows={2} {...form.register(`goals.${i}.note` as const)} />
                      </FormField>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FormSection title={t("sessions.followUp")}>
        <FormField label={t("sessions.followUp")} htmlFor="s-fu" className="sm:col-span-2">
          <Textarea id="s-fu" rows={2} {...form.register("followUp")} />
        </FormField>
        <FormField label={t("sessions.parentParticipation")} htmlFor="s-pp" className="sm:col-span-2">
          <Textarea id="s-pp" rows={2} {...form.register("parentParticipation")} />
        </FormField>
        <FormField label={t("sessions.homeActivity")} htmlFor="s-home" hint={t("sessions.homeActivityHint")} className="sm:col-span-2">
          <Textarea id="s-home" rows={2} {...form.register("homeActivitySuggestion")} />
        </FormField>
      </FormSection>

      <div className="sticky bottom-20 z-10 flex flex-wrap justify-end gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-raised)] backdrop-blur lg:bottom-4">
        <Button type="submit" variant="secondary" loading={pending}>{t("sessions.saveDraft")}</Button>
        {status === "in_progress" && (
          <ConfirmActionButton label={t("sessions.complete")} action={async () => {
            if (dirty) {
              const saved = await saveSessionNoteAction(form.getValues());
              if (!saved.ok) return saved;
            }
            return completeSessionAction(initial.sessionId);
          }} variant="accent" size="md" icon={<CheckCircle2 />} />
        )}
        {status === "completed" && (
          <ConfirmActionButton label={t("sessions.sign")} confirmText={t("sessions.signConfirm")} action={async () => {
            if (dirty) {
              const saved = await saveSessionNoteAction(form.getValues());
              if (!saved.ok) return saved;
            }
            return signSessionAction(initial.sessionId);
          }} variant="primary" size="md" icon={<PenLine />} />
        )}
      </div>
    </form>
  );
}

export function AddObservation({ sessionId }: { sessionId: string }) {
  const t = useT();
  const router = useRouter();
  const [category, setCategory] = useState("general");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await addObservationAction({ sessionId, category, observation: text });
      if (!res.ok) return void toast.error(t(res.error));
      setText("");
      router.refresh();
    });
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
      <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("sessions.observationCategory")}>
        {["general", "communication", "behaviour", "sensory", "motor", "social", "health"].map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("sessions.observation")} aria-label={t("sessions.observation")} />
      <Button variant="secondary" onClick={submit} disabled={!text.trim()} loading={pending}><Plus /> {t("common.add")}</Button>
    </div>
  );
}
