import Link from "next/link";
import { SearchX } from "lucide-react";
import { getT } from "@/i18n/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-navy-50 text-navy-500"><SearchX className="size-7" /></div>
        <h1 className="text-xl font-bold">{t("errors.notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.notFound")}</p>
        <Button asChild className="mt-6"><Link href="/">{t("errors.goHome")}</Link></Button>
      </div>
    </main>
  );
}
