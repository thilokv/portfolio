"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { LANGUAGES, RELATIONSHIPS } from "@/lib/constants";
import { addGuardianSchema } from "@/lib/validation/children";
import { addGuardianAction, enablePortalAction } from "@/server/actions/children";
import type { z } from "zod";

export function AddGuardianDialog({ childId }: { childId: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<z.infer<typeof addGuardianSchema>>({
    schema: addGuardianSchema,
    defaultValues: { childId, fullName: "", phone: "", alternatePhone: "", email: "", relationship: "father", preferredLanguage: "te", isPrimary: false },
    action: addGuardianAction,
    successMessage: "children.guardianAdded",
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm"><UserPlus /> {t("children.addGuardian")}</Button>
      </DialogTrigger>
      <DialogContent title={t("children.addGuardian")}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label={t("children.guardianName")} htmlFor="ag-name" required error={err("fullName")} className="sm:col-span-2">
            <Input id="ag-name" {...form.register("fullName")} />
          </FormField>
          <FormField label={t("children.relationship")} htmlFor="ag-rel" required>
            <Select id="ag-rel" {...form.register("relationship")}>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{t(`enum.relationship.${r}`)}</option>)}
            </Select>
          </FormField>
          <FormField label={t("children.guardianPhone")} htmlFor="ag-phone" required error={err("phone")}>
            <Input id="ag-phone" type="tel" inputMode="tel" {...form.register("phone")} />
          </FormField>
          <FormField label={t("children.guardianAltPhone")} htmlFor="ag-alt" error={err("alternatePhone")}>
            <Input id="ag-alt" type="tel" inputMode="tel" {...form.register("alternatePhone")} />
          </FormField>
          <FormField label={t("children.guardianEmail")} htmlFor="ag-email" error={err("email")}>
            <Input id="ag-email" type="email" {...form.register("email")} />
          </FormField>
          <FormField label={t("children.preferredLanguage")} htmlFor="ag-lang">
            <Select id="ag-lang" {...form.register("preferredLanguage")}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{t(`enum.language.${l}`)}</option>)}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox {...form.register("isPrimary")} /> {t("children.primary")}</label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EnablePortalButton({ childId, guardianId }: { childId: string; guardianId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      const res = await enablePortalAction({ childId, guardianId });
      if (!res.ok) return void toast.error(t(res.error));
      if (res.data?.password) setPassword(res.data.password);
      else toast.success(t("common.saved"));
      router.refresh();
    });
  return (
    <>
      <Button variant="secondary" size="sm" onClick={run} loading={pending}><KeyRound /> {t("children.enablePortal")}</Button>
      <Dialog open={!!password} onOpenChange={(o) => !o && setPassword(null)}>
        <DialogContent title={t("children.portalAccess")}>
          <Alert tone="success" title={t("children.portalEnabled", { password: password ?? "" })}>{t("children.portalEnabledHint")}</Alert>
          <p className="mt-4 select-all rounded-xl bg-navy-50 p-3 text-center font-mono text-lg tracking-wider" data-testid="temp-password">{password}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
