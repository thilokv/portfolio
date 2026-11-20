import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import type { TranslateFn } from "@/i18n";
import { formatDate } from "@/lib/dates";

export function SessionList({
  rows,
  t,
  locale,
  showChild = true,
}: {
  rows: { id: string; sessionDate: string; status: string; childName: string; childCode: string; serviceCode: string; therapistName: string; attendance: string }[];
  t: TranslateFn;
  locale: string;
  showChild?: boolean;
}) {
  return (
    <Card>
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("sessions.empty")} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/sessions/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-navy-50/60 sm:px-5">
                <div className="w-24 shrink-0 text-sm font-medium tabular-nums text-ink">{formatDate(s.sessionDate, locale)}</div>
                <div className="min-w-0 flex-1">
                  {showChild && <p className="truncate font-medium text-ink">{s.childName} <span className="text-xs text-muted">{s.childCode}</span></p>}
                  <p className="truncate text-xs text-muted">{t(`enum.service.${s.serviceCode}`)} · {s.therapistName} · {t(`enum.attendance.${s.attendance}`)}</p>
                </div>
                <StatusBadge kind="session" status={s.status} t={t} />
                <ChevronRight className="size-4 text-navy-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
