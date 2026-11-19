"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<LoginInput, { redirectTo: string }>({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    action: loginAction,
    onSuccess: ({ data }) => {
      router.replace(data?.redirectTo ?? "/");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField label={t("auth.email")} htmlFor="email" error={err("email")}>
        <Input id="email" type="email" autoComplete="username" inputMode="email" aria-invalid={!!err("email")} {...form.register("email")} />
      </FormField>
      <FormField label={t("auth.password")} htmlFor="password" error={err("password")}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!err("password")} {...form.register("password")} />
      </FormField>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-teal-700 hover:underline">
          {t("auth.forgotPassword")}
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
