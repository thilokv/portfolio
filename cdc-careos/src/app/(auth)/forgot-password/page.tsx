"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordAction } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: forgotPasswordAction,
    onSuccess: () => setSent(true),
  });
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.resetTitle")}</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">{t("auth.resetSubtitle")}</p>
      {sent ? (
        <Alert tone="success">{t("auth.resetSent")}</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label={t("auth.email")} htmlFor="email" error={err("email")}>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            {t("auth.sendResetLink")}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm font-medium text-teal-700 hover:underline">
        {t("auth.backToSignIn")}
      </Link>
    </>
  );
}
