import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getActor } from "@/server/auth/actor";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (actor) redirect(actor.kind === "guardian" ? "/portal" : "/dashboard");
  const t = await getT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo inverted />
        <div className="relative z-10 max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Coordinated care, clear records and confident families.
          </p>
          <p className="mt-4 text-navy-200">
            Therapy coordination, development tracking and parent communication for small child development centers.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-navy-300">
          <ShieldCheck className="size-4" aria-hidden /> {t("auth.securityNote")}
        </p>
        <div aria-hidden className="absolute -right-24 top-1/3 size-96 rounded-full bg-teal-500/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-80 rounded-full bg-sky-500/10 blur-3xl" />
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="lg:invisible"><Logo /></span>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-slide-up">{children}</div>
        <p className="text-center text-xs text-muted">{t("app.fictionalDataNotice")}</p>
      </main>
    </div>
  );
}
