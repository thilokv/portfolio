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

export interface DemoSignIn {
  password: string;
  accounts: { email: string; label: string }[];
}

export function LoginForm({ demo }: { demo?: DemoSignIn }) {
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
  const signInAs = (email: string) => {
    if (!demo || pending) return;
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", demo.password, { shouldValidate: true });
    void onSubmit();
  };
  return (
    <>
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
    {demo && (
      <section aria-labelledby="demo-accounts" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <h2 id="demo-accounts" className="text-sm font-semibold">
          {t("auth.demoTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted">{t("auth.demoHint", { password: demo.password })}</p>
        <div className="mt-3 grid gap-2">
          {demo.accounts.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={pending}
              onClick={() => signInAs(a.email)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left text-sm transition hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60"
            >
              <span className="font-medium">{a.label}</span>
              <span className="min-w-0 truncate text-xs text-muted">{a.email}</span>
            </button>
          ))}
        </div>
      </section>
    )}
    </>
  );
}
