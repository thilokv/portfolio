"use client";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePasswordAction } from "@/server/actions/auth";

export function ChangePasswordCard({ mustChange = false }: { mustChange?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm({
    schema: changePasswordSchema,
    defaultValues: { currentPassword: "", password: "", confirm: "" },
    action: changePasswordAction,
    onSuccess: ({ data }) => {
      form.reset();
      if (mustChange) router.replace((data as { redirectTo?: string } | undefined)?.redirectTo ?? "/");
      router.refresh();
    },
  });
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-teal-600" aria-hidden /> {t("auth.changePassword")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mustChange && <Alert tone="warning" className="mb-4">{t("auth.mustChangePassword")}</Alert>}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label={t("auth.currentPassword")} htmlFor="currentPassword" error={err("currentPassword")}>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
          </FormField>
          <FormField label={t("auth.newPassword")} htmlFor="newPassword" error={err("password")} hint={t("auth.passwordHint")}>
            <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("password")} />
          </FormField>
          <FormField label={t("auth.confirmPassword")} htmlFor="confirm" error={err("confirm")}>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
          </FormField>
          <Button type="submit" loading={pending} className="w-full sm:w-auto">{t("auth.setPassword")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
