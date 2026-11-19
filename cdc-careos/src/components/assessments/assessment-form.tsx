"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSection } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { isoDateIST } from "@/lib/dates";
import { assessmentSchema, type AssessmentInput } from "@/lib/validation/assessments";
import { saveAssessmentAction } from "@/server/actions/assessments";

export function AssessmentForm({
  initial,
  roles,
  services,
  canRestrict,
}: {
  initial: AssessmentInput;
  roles: string[];
  services: { id: string; code: string }[];
  canRestrict: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<AssessmentInput, { id: string }>({
    schema: assessmentSchema,
    defaultValues: initial,
    action: saveAssessmentAction,
    onSuccess: ({ data }) => {
      router.push(`/children/${initial.childId}/assessments/${data?.id}`);
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert tone="info">{t("assessments.noDiagnosisNotice")}</Alert>
      <FormSection title={t("common.details")}>
        <FormField label={t("assessments.assessorRole")} htmlFor="assessorRole" required>
          <Select id="assessorRole" {...form.register("assessorRole")}>
            {roles.map((r) => <option key={r} value={r}>{t(`enum.role.${r}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("assessments.service")} htmlFor="serviceId">
          <Select id="serviceId" {...form.register("serviceId")}>
            <option value="">—</option>
            {services.map((s) => <option key={s.id} value={s.id}>{t(`enum.service.${s.code}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("assessments.date")} htmlFor="assessmentDate" required error={err("assessmentDate")}>
          <Input id="assessmentDate" type="date" max={isoDateIST()} {...form.register("assessmentDate")} />
        </FormField>
        <FormField label={t("assessments.reviewDate")} htmlFor="reviewDate" error={err("reviewDate")}>
          <Input id="reviewDate" type="date" {...form.register("reviewDate")} />
        </FormField>
        <FormField label={t("assessments.tool")} htmlFor="toolName" required hint={t("assessments.toolHint")} error={err("toolName")}>
          <Input id="toolName" {...form.register("toolName")} />
        </FormField>
        <FormField label={t("assessments.toolVersion")} htmlFor="toolVersion" error={err("toolVersion")}>
          <Input id="toolVersion" {...form.register("toolVersion")} />
        </FormField>
        <FormField label={t("assessments.reason")} htmlFor="reason" className="sm:col-span-2" error={err("reasonForAssessment")}>
          <Textarea id="reason" rows={2} {...form.register("reasonForAssessment")} />
        </FormField>
        {canRestrict && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox {...form.register("isRestricted")} /> {t("assessments.restrictedLabel")}
          </label>
        )}
      </FormSection>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">{t("assessments.domainsTitle")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t("assessments.domainsHint")}</p>
        {err("domains") && <p className="mt-2 text-xs font-medium text-danger-600" role="alert">{t(err("domains")!)}</p>}
        <div className="mt-4 space-y-3">
          {initial.domains.map((d, i) => (
            <details key={d.domain} className="group rounded-xl border border-line open:bg-canvas/60" open={i < 2 || !!(d.findings || d.observations)}>
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink marker:hidden">
                <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
                {t(`enum.domain.${d.domain}`)}
              </summary>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                <FormField label={t("assessments.findings")} htmlFor={`d-${i}-f`} error={err(`domains.${i}.findings` as never)}>
                  <Textarea id={`d-${i}-f`} rows={3} {...form.register(`domains.${i}.findings` as const)} />
                </FormField>
                <FormField label={t("assessments.observations")} htmlFor={`d-${i}-o`} error={err(`domains.${i}.observations` as never)}>
                  <Textarea id={`d-${i}-o`} rows={3} {...form.register(`domains.${i}.observations` as const)} />
                </FormField>
              </div>
            </details>
          ))}
        </div>
      </section>

      <FormSection title={t("assessments.overall")}>
        <FormField label={t("assessments.overall")} htmlFor="overall" className="sm:col-span-2" error={err("overallObservations")}>
          <Textarea id="overall" rows={4} {...form.register("overallObservations")} />
        </FormField>
        <FormField label={t("assessments.recommendations")} htmlFor="recs" className="sm:col-span-2" error={err("recommendations")}>
          <Textarea id="recs" rows={4} {...form.register("recommendations")} />
        </FormField>
      </FormSection>

      <div className="sticky bottom-20 flex justify-end gap-2 lg:bottom-4">
        <Button type="button" variant="secondary" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
