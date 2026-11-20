import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { getT } from "@/i18n/server";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getT();
  return (
    <>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">{t("auth.setPassword")}</h1>
      {token && token.length >= 20 ? <ResetForm token={token} /> : <Alert tone="danger">{t("auth.resetInvalid")}</Alert>}
      <Link href="/login" className="mt-6 block text-center text-sm font-medium text-teal-700 hover:underline">
        {t("auth.backToSignIn")}
      </Link>
    </>
  );
}
