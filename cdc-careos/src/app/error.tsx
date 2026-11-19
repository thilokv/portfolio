"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

/** Generic error boundary — never shows internal error details to users. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error.digest ?? "client error");
  }, [error]);
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-50 text-danger-600"><AlertTriangle className="size-7" /></div>
        <h1 className="text-xl font-bold">{t("errors.pageTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.unexpected")}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref: {error.digest}</p>}
        <Button className="mt-6" onClick={reset}>{t("common.tryAgain")}</Button>
      </div>
    </main>
  );
}
