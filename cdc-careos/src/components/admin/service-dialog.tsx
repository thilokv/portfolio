"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { serviceUpdateSchema, type ServiceUpdateInput } from "@/lib/validation/admin";
import { updateServiceAction } from "@/server/actions/admin";

export function ServiceDialog({ initial }: { initial: ServiceUpdateInput }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<ServiceUpdateInput>({
    schema: serviceUpdateSchema,
    defaultValues: initial,
    action: updateServiceAction,
    successMessage: "admin.serviceUpdated",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Pencil /> {t("common.edit")}</Button></DialogTrigger>
      <DialogContent title={initial.name}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label={t("admin.serviceName")} htmlFor="sv-name" required error={err("name")}><Input id="sv-name" {...form.register("name")} /></FormField>
          <FormField label={t("admin.serviceNameTe")} htmlFor="sv-te" error={err("nameTe")}><Input id="sv-te" lang="te" {...form.register("nameTe")} /></FormField>
          <FormField label={t("admin.description")} htmlFor="sv-desc" error={err("description")}><Textarea id="sv-desc" rows={2} {...form.register("description")} /></FormField>
          <FormField label={t("admin.defaultDuration")} htmlFor="sv-dur" required error={err("defaultDurationMinutes")}><Input id="sv-dur" inputMode="numeric" {...form.register("defaultDurationMinutes")} /></FormField>
          <label className="flex items-center gap-2 text-sm"><Checkbox {...form.register("isActive")} /> {t("admin.active")}</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
