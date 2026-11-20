import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { portalAppointments } from "@/server/services/portal";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime, formatTime } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";

export default async function PortalAppointments() {
  const actor = await requireGuardianPage();
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(guardianCtx(actor), (tx) => portalAppointments(tx, actor));
  return (
    <>
      <PageHeader title={t("portal.upcoming")} />
      <Card>
        {rows.length === 0 ? <EmptyState title={t("portal.noAppointments")} /> : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div>
                  <p className="font-semibold text-ink">{formatDateTime(a.startsAt, locale)} – {formatTime(a.endsAt, locale)}</p>
                  <p className="text-sm text-muted">{a.childName} · {locale === "te" && a.serviceNameTe ? a.serviceNameTe : t(`enum.service.${a.serviceCode}`)} · {t("portal.with", { name: a.staffName })}{a.room ? ` · ${a.room}` : ""}</p>
                </div>
                <StatusBadge kind="appointment" status={a.status} t={t} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
