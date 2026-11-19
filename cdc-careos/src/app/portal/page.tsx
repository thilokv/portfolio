import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileText, Heart, ShieldCheck } from "lucide-react";
import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { portalAppointments, portalChildren, portalMessages, portalReports } from "@/server/services/portal";
import { getLocale, getT } from "@/i18n/server";
import { formatAge, formatDate, formatDateTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Parent portal" };

export default async function PortalHome() {
  const actor = await requireGuardianPage();
  const [t, locale] = [await getT(), await getLocale()];
  const data = await withOrg(guardianCtx(actor), async (tx) => ({
    kids: await portalChildren(tx, actor),
    appts: (await portalAppointments(tx, actor)).slice(0, 3),
    reports: (await portalReports(tx, actor)).slice(0, 3),
    activities: (await portalMessages(tx, actor, "home_activity")).slice(0, 3),
  }));
  return (
    <>
      <PageHeader title={t("portal.welcome", { name: actor.name.split(" ")[0] })} description={t("portal.subtitle")} />
      {data.kids.length === 0 ? (
        <Card><EmptyState title={t("portal.noChildren")} /></Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.kids.map((k) => (
              <Card key={k.id} className="flex items-center gap-4 p-4" data-testid="portal-child">
                <Avatar name={k.fullName} className="size-12" />
                <div>
                  <p className="font-semibold text-ink">{k.preferredName ?? k.fullName}</p>
                  <p className="text-xs text-muted">{k.childCode} · {formatAge(k.dateOfBirth, t)}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4 text-sky-600" />{t("portal.upcoming")}</CardTitle></CardHeader>
              <CardContent>
                {data.appts.length === 0 ? <p className="text-sm text-muted">{t("portal.noAppointments")}</p> : (
                  <ul className="space-y-3">
                    {data.appts.map((a) => (
                      <li key={a.id}>
                        <p className="text-sm font-semibold text-ink">{formatDateTime(a.startsAt, locale)}</p>
                        <p className="text-xs text-muted">{locale === "te" && a.serviceNameTe ? a.serviceNameTe : t(`enum.service.${a.serviceCode}`)} · {t("portal.with", { name: a.staffName })}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/portal/appointments" className="mt-3 inline-block text-xs font-medium text-teal-700 hover:underline">{t("common.viewAll")}</Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-teal-600" />{t("portal.reports")}</CardTitle></CardHeader>
              <CardContent>
                {data.reports.length === 0 ? <p className="text-sm text-muted">{t("portal.noReports")}</p> : (
                  <ul className="space-y-3">
                    {data.reports.map((r) => (
                      <li key={r.id}>
                        <Link href={`/portal/reports/${r.id}`} className="text-sm font-semibold text-ink hover:text-teal-700">{r.title}</Link>
                        <p className="text-xs text-muted">{t("portal.sharedOn", { date: formatDate(r.sharedAt, locale) })}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="size-4 text-warning-600" />{t("portal.activities")}</CardTitle></CardHeader>
              <CardContent>
                {data.activities.length === 0 ? <p className="text-sm text-muted">{t("portal.noActivities")}</p> : (
                  <ul className="space-y-3">
                    {data.activities.map(({ m }) => (
                      <li key={m.id}><Link href="/portal/activities" className="text-sm font-semibold text-ink hover:text-teal-700">{m.subject}</Link></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <Alert tone="info" title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" />{t("portal.privacyNote")}</span>} />
        </div>
      )}
    </>
  );
}
