"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSection } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { CHILD_STATUSES, LANGUAGES, RELATIONSHIPS } from "@/lib/constants";
import { isoDateIST } from "@/lib/dates";
import {
  registerChildSchema,
  SEX_VALUES,
  updateChildSchema,
  type RegisterChildInput,
  type UpdateChildInput,
} from "@/lib/validation/children";
import { registerChildAction, updateChildAction } from "@/server/actions/children";

type ProfileFieldsForm = ReturnType<typeof useActionForm<RegisterChildInput>>;

function ProfileFields({ f }: { f: Pick<ProfileFieldsForm, "form" | "err"> }) {
  const t = useT();
  const { form, err } = f;
  const r = form.register as unknown as (n: string) => object;
  const e = err as (n: string) => string | undefined;
  return (
    <>
      <FormSection title={t("children.sectionBasics")}>
        <FormField label={t("children.fullName")} htmlFor="fullName" required error={e("fullName")}>
          <Input id="fullName" autoComplete="off" aria-invalid={!!e("fullName")} {...r("fullName")} />
        </FormField>
        <FormField label={t("children.preferredName")} htmlFor="preferredName" error={e("preferredName")}>
          <Input id="preferredName" autoComplete="off" {...r("preferredName")} />
        </FormField>
        <FormField label={t("children.dob")} htmlFor="dateOfBirth" required error={e("dateOfBirth")}>
          <Input id="dateOfBirth" type="date" max={isoDateIST()} aria-invalid={!!e("dateOfBirth")} {...r("dateOfBirth")} />
        </FormField>
        <FormField label={t("children.sex")} htmlFor="sex" error={e("sex")}>
          <Select id="sex" {...r("sex")}>
            {SEX_VALUES.map((s) => (
              <option key={s} value={s}>{s ? t(`enum.sex.${s}`) : "—"}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("children.preferredLanguage")} htmlFor="preferredLanguage" required>
          <Select id="preferredLanguage" {...r("preferredLanguage")}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{t(`enum.language.${l}`)}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("children.referralSource")} htmlFor="referralSource" error={e("referralSource")}>
          <Input id="referralSource" {...r("referralSource")} />
        </FormField>
        <FormField label={t("children.address")} htmlFor="address" className="sm:col-span-2" error={e("address")}>
          <Textarea id="address" rows={2} {...r("address")} />
        </FormField>
        <FormField label={t("children.emergencyName")} htmlFor="emergencyContactName" error={e("emergencyContactName")}>
          <Input id="emergencyContactName" {...r("emergencyContactName")} />
        </FormField>
        <FormField label={t("children.emergencyPhone")} htmlFor="emergencyContactPhone" error={e("emergencyContactPhone")}>
          <Input id="emergencyContactPhone" type="tel" inputMode="tel" aria-invalid={!!e("emergencyContactPhone")} {...r("emergencyContactPhone")} />
        </FormField>
        <FormField label={t("children.emergencyRelation")} htmlFor="emergencyContactRelation" error={e("emergencyContactRelation")}>
          <Input id="emergencyContactRelation" {...r("emergencyContactRelation")} />
        </FormField>
      </FormSection>

      <FormSection title={t("children.sectionHistory")}>
        <FormField label={t("children.developmentalHistory")} htmlFor="developmentalHistory" hint={t("children.developmentalHistoryHint")} className="sm:col-span-2" error={e("developmentalHistory")}>
          <Textarea id="developmentalHistory" rows={4} {...r("developmentalHistory")} />
        </FormField>
        <FormField label={t("children.parentConcerns")} htmlFor="parentConcerns" className="sm:col-span-2" error={e("parentConcerns")}>
          <Textarea id="parentConcerns" rows={3} {...r("parentConcerns")} />
        </FormField>
        <FormField label={t("children.medicalHistory")} htmlFor="medicalHistory" className="sm:col-span-2" error={e("medicalHistory")}>
          <Textarea id="medicalHistory" rows={3} {...r("medicalHistory")} />
        </FormField>
        <FormField label={t("children.existingReports")} htmlFor="existingReportsSummary" hint={t("children.existingReportsHint")} className="sm:col-span-2" error={e("existingReportsSummary")}>
          <Textarea id="existingReportsSummary" rows={3} {...r("existingReportsSummary")} />
        </FormField>
      </FormSection>
    </>
  );
}

const emptyProfile = {
  fullName: "",
  preferredName: "",
  dateOfBirth: "",
  sex: "" as const,
  preferredLanguage: "te" as const,
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  developmentalHistory: "",
  parentConcerns: "",
  medicalHistory: "",
  existingReportsSummary: "",
  referralSource: "",
};

export function RegisterChildForm() {
  const t = useT();
  const router = useRouter();
  const f = useActionForm<RegisterChildInput, { id: string; code: string }>({
    schema: registerChildSchema,
    defaultValues: {
      ...emptyProfile,
      guardian: { fullName: "", phone: "", alternatePhone: "", email: "", relationship: "mother", preferredLanguage: "te" },
      consentRegistration: false,
    },
    action: registerChildAction,
    onSuccess: ({ data }) => {
      toast.success(t("children.created", { code: data?.code ?? "" }));
      router.push(`/children/${data?.id}`);
    },
  });
  const { form, onSubmit, pending, err } = f;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert tone="warning">{t("children.registerSubtitle")}</Alert>
      <ProfileFields f={f} />
      <FormSection title={t("children.guardianSection")}>
        <FormField label={t("children.guardianName")} htmlFor="g.fullName" required error={err("guardian.fullName")}>
          <Input id="g.fullName" {...form.register("guardian.fullName")} />
        </FormField>
        <FormField label={t("children.relationship")} htmlFor="g.relationship" required>
          <Select id="g.relationship" {...form.register("guardian.relationship")}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>{t(`enum.relationship.${r}`)}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("children.guardianPhone")} htmlFor="g.phone" required error={err("guardian.phone")}>
          <Input id="g.phone" type="tel" inputMode="tel" aria-invalid={!!err("guardian.phone")} {...form.register("guardian.phone")} />
        </FormField>
        <FormField label={t("children.guardianAltPhone")} htmlFor="g.alternatePhone" error={err("guardian.alternatePhone")}>
          <Input id="g.alternatePhone" type="tel" inputMode="tel" {...form.register("guardian.alternatePhone")} />
        </FormField>
        <FormField label={t("children.guardianEmail")} htmlFor="g.email" error={err("guardian.email")}>
          <Input id="g.email" type="email" inputMode="email" {...form.register("guardian.email")} />
        </FormField>
        <FormField label={t("children.preferredLanguage")} htmlFor="g.lang">
          <Select id="g.lang" {...form.register("guardian.preferredLanguage")}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{t(`enum.language.${l}`)}</option>
            ))}
          </Select>
        </FormField>
      </FormSection>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">{t("children.consentSection")}</h2>
        <label className="mt-3 flex items-start gap-3">
          <Checkbox id="consentRegistration" className="mt-0.5" {...form.register("consentRegistration")} />
          <span>
            <span className="text-sm font-medium text-ink">{t("children.consentRegistration")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("children.consentRegistrationHint")}</span>
            {err("consentRegistration") && <span className="mt-1 block text-xs font-medium text-danger-600" role="alert">{t(err("consentRegistration")!)}</span>}
          </span>
        </label>
      </section>
      <div className="sticky bottom-20 flex justify-end gap-2 lg:bottom-4">
        <Button type="button" variant="secondary" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button type="submit" variant="accent" loading={pending}>{t("children.register")}</Button>
      </div>
    </form>
  );
}

export function EditChildForm({ initial }: { initial: UpdateChildInput }) {
  const t = useT();
  const router = useRouter();
  const f = useActionForm<UpdateChildInput>({
    schema: updateChildSchema,
    defaultValues: initial,
    action: updateChildAction,
    onSuccess: () => {
      router.push(`/children/${initial.id}`);
      router.refresh();
    },
  });
  const { form, onSubmit, pending } = f;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <ProfileFields f={f as unknown as Pick<ProfileFieldsForm, "form" | "err">} />
      <FormSection title={t("children.status")}>
        <FormField label={t("children.status")} htmlFor="status">
          <Select id="status" {...form.register("status")}>
            {CHILD_STATUSES.filter((s) => s !== "archived").map((s) => (
              <option key={s} value={s}>{t(`enum.childStatus.${s}`)}</option>
            ))}
          </Select>
        </FormField>
      </FormSection>
      <div className="sticky bottom-20 flex justify-end gap-2 lg:bottom-4">
        <Button type="button" variant="secondary" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
