import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/dates";
import { humanizeAction } from "@/lib/format";
import type { TranslateFn } from "@/i18n";

type Row = { id: number; action: string; actorName: string | null; actorType: string; entityType: string; summary: string | null; changes: unknown; createdAt: Date; ipAddress: string | null };

export function AuditTable({ rows, t, locale }: { rows: Row[]; t: TranslateFn; locale: string }) {
  return (
    <Card>
      {rows.length === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <ul className="divide-y divide-line" data-testid="audit-list">
          {rows.map((r) => {
            const changes = r.changes && typeof r.changes === "object" ? Object.entries(r.changes as Record<string, { from?: unknown; to?: unknown }>).filter(([k]) => k !== "organizationId") : [];
            return (
              <li key={r.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm">
                    <span className="font-medium text-ink">{humanizeAction(r.action)}</span>
                    <span className="text-muted"> · {r.entityType}</span>
                    {r.summary && <span className="text-navy-700"> — {r.summary}</span>}
                  </p>
                  <p className="text-xs text-muted">{r.actorName ?? r.actorType} · {formatDateTime(r.createdAt, locale)}</p>
                </div>
                {changes.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-navy-500">{t("audit.changes")} ({changes.length})</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-navy-700">
                      {changes.map(([k, v]) => (
                        <li key={k} className="break-words"><span className="font-medium">{k}</span>: {String(v?.from ?? "—").slice(0, 120)} → {String(v?.to ?? "—").slice(0, 120)}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
