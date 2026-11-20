"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { setLocaleAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (next: "en" | "te") => {
    if (next === locale) return;
    start(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };
  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn("inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 text-xs font-semibold", pending && "opacity-60", className)}
    >
      {!compact && <Languages className="ml-1.5 mr-0.5 size-3.5 text-navy-400" aria-hidden />}
      {(["en", "te"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          data-testid={`lang-${l}`}
          className={cn(
            "rounded-[10px] px-2.5 py-1.5 transition",
            locale === l ? "bg-navy-800 text-white" : "text-navy-500 hover:bg-navy-50",
          )}
        >
          {l === "en" ? "EN" : "తెలుగు"}
        </button>
      ))}
    </div>
  );
}
