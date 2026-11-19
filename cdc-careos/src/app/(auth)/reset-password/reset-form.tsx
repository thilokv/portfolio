"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm({
    schema: resetPasswordSchema,
    defaultValues: { token, password: "", confirm: "" },
    action: resetPasswordAction,
    onSuccess: () => setDone(true),
  });
  if (done)
    return (
      <div className="space-y-6">
        <Alert tone="success">{t("auth.resetDone")}</Alert>
        <Button asChild size="lg" className="w-full"><Link href="/login">{t("auth.signIn")}</Link></Button>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField label={t("auth.newPassword")} htmlFor="password" error={err("password")} hint={t("auth.passwordHint")}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField label={t("auth.confirmPassword")} htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={pending}>{t("auth.setPassword")}</Button>
    </form>
  );
}
