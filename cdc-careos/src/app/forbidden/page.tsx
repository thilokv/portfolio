import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getT } from "@/i18n/server";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-warning-50 text-warning-600"><ShieldAlert className="size-7" /></div>
        <h1 className="text-xl font-bold">{t("errors.forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.forbidden")}</p>
        <Button asChild className="mt-6"><Link href="/">{t("errors.goHome")}</Link></Button>
      </div>
    </main>
  );
}
