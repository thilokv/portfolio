"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT, useI18n } from "@/i18n/client";
import { CONSENT_STATUSES, CONSENT_TYPES } from "@/lib/constants";
import { formatDate, isoDateIST } from "@/lib/dates";
import { consentSchema, type ConsentInput } from "@/lib/validation/children";
import { recordConsentAction } from "@/server/actions/children";

const TONE = { granted: "success", withdrawn: "danger", pending: "warning", refused: "danger" } as const;

export function ConsentPanel({
  childId,
  latest,
  guardians,
  canManage,
}: {
  childId: string;
  latest: Record<string, { status: string; effectiveDate: string; method: string; guardianName: string | null } | undefined>;
  guardians: { id: string; fullName: string }[];
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<ConsentInput>({
    schema: consentSchema,
    defaultValues: { childId, consentType: "therapy_services", status: "granted", givenByGuardianId: guardians[0]?.id ?? "", method: "paper_form", effectiveDate: isoDateIST(), notes: "" },
    action: recordConsentAction,
    successMessage: "children.consentRecorded",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <div>
      <ul className="divide-y divide-line">
        {CONSENT_TYPES.map((type) => {
          const c = latest[type];
          return (
            <li key={type} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-ink">{t(`enum.consentType.${type}`)}</p>
                {c && <p className="text-xs text-muted">{formatDate(c.effectiveDate, locale)}{c.guardianName ? ` · ${c.guardianName}` : ""}</p>}
              </div>
              {c ? <Badge tone={TONE[c.status as keyof typeof TONE]}>{t(`enum.consentStatus.${c.status}`)}</Badge> : <Badge tone="neutral">{t("common.notRecorded")}</Badge>}
            </li>
          );
        })}
      </ul>
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="mt-3"><ShieldPlus /> {t("children.recordConsent")}</Button>
          </DialogTrigger>
          <DialogContent title={t("children.recordConsent")}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormField label={t("audit.entity")} htmlFor="c-type" required>
                <Select id="c-type" {...form.register("consentType")}>
                  {CONSENT_TYPES.map((c) => <option key={c} value={c}>{t(`enum.consentType.${c}`)}</option>)}
                </Select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t("common.status")} htmlFor="c-status" required>
                  <Select id="c-status" {...form.register("status")}>
                    {CONSENT_STATUSES.map((c) => <option key={c} value={c}>{t(`enum.consentStatus.${c}`)}</option>)}
                  </Select>
                </FormField>
                <FormField label={t("children.consentMethod")} htmlFor="c-method" required>
                  <Select id="c-method" {...form.register("method")}>
                    {(["paper_form", "verbal", "portal"] as const).map((m) => <option key={m} value={m}>{t(`children.consentMethods.${m}`)}</option>)}
                  </Select>
                </FormField>
                <FormField label={t("children.givenBy")} htmlFor="c-guardian">
                  <Select id="c-guardian" {...form.register("givenByGuardianId")}>
                    <option value="">—</option>
                    {guardians.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                  </Select>
                </FormField>
                <FormField label={t("children.effectiveDate")} htmlFor="c-date" required error={err("effectiveDate")}>
                  <Input id="c-date" type="date" {...form.register("effectiveDate")} />
                </FormField>
              </div>
              <FormField label={t("common.notes")} htmlFor="c-notes" error={err("notes")}>
                <Textarea id="c-notes" rows={2} {...form.register("notes")} />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" loading={pending}>{t("common.save")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
