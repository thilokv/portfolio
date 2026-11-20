"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

/** Shows reviewed Telugu text to Telugu readers, with a toggle to English. */
export function BilingualText({ en, te }: { en: string; te: string | null }) {
  const { locale, t } = useI18n();
  const [showTe, setShowTe] = useState(locale === "te" && !!te);
  return (
    <div>
      <p lang={showTe ? "te" : "en"} className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{showTe && te ? te : en}</p>
      {te && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => setShowTe(!showTe)} className="font-medium text-teal-700 hover:underline">
            {showTe ? t("portal.showEnglish") : t("portal.showTelugu")}
          </button>
          {showTe && <span className="text-muted">{t("portal.translationNote")}</span>}
        </div>
      )}
    </div>
  );
}
