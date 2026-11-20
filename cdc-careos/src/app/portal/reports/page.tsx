import Link from "next/link";
import { FileText } from "lucide-react";
import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { portalDocuments, portalReports } from "@/server/services/portal";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export default async function PortalReports() {
  const actor = await requireGuardianPage();
  const [t, locale] = [await getT(), await getLocale()];
  const { reports, docs } = await withOrg(guardianCtx(actor), async (tx) => ({ reports: await portalReports(tx, actor), docs: await portalDocuments(tx, actor) }));
  return (
    <>
      <PageHeader title={t("portal.reports")} description={t("portal.privacyNote")} />
      <Card>
        {reports.length === 0 ? <EmptyState icon={FileText} title={t("portal.noReports")} /> : (
          <ul className="divide-y divide-line" data-testid="portal-reports">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/portal/reports/${r.id}`} className="block px-5 py-4 hover:bg-navy-50/60">
                  <p className="font-semibold text-ink">{r.title}</p>
                  <p className="text-xs text-muted">{r.childName} · {t(`enum.reportType.${r.reportType}`)} · {t("portal.sharedOn", { date: formatDate(r.sharedAt, locale) })}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {docs.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>{t("documents.title")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id}><a className="text-sm font-medium text-teal-700 hover:underline" href={`/api/documents/${d.id}`}>{d.title}</a> <span className="text-xs text-muted">· {formatDate(d.createdAt, locale)}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
