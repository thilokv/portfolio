import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { DEMO_PASSWORD, DEMO_SIGN_IN_ACCOUNTS } from "@/lib/demo";
import { isDemoMode } from "@/lib/runtime-env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const t = await getT();
  // Public demo: the shared demo accounts are offered for one-tap sign-in.
  const demo = isDemoMode()
    ? { password: DEMO_PASSWORD, accounts: DEMO_SIGN_IN_ACCOUNTS.map((a) => ({ email: a.email, label: t(a.labelKey) })) }
    : undefined;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.signInTitle")}</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">{t("auth.signInSubtitle")}</p>
      <LoginForm demo={demo} />
    </>
  );
}
