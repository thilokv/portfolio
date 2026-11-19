import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const t = await getT();
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.signInTitle")}</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">{t("auth.signInSubtitle")}</p>
      <LoginForm />
    </>
  );
}
