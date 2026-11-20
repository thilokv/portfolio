import { notFound } from "next/navigation";
import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { portalReport } from "@/server/services/portal";
import { NotFoundError } from "@/server/errors";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { BilingualText } from "@/components/portal/bilingual-text";

export default async function PortalReportPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireGuardianPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = [await getT(), await getLocale()];
  let r;
  try {
    r = await withOrg(guardianCtx(actor), (tx) => portalReport(tx, actor, id));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <>
      <PageHeader eyebrow={t(`enum.reportType.${r.reportType}`)} title={r.title} description={`${r.childName} · ${t("portal.sharedOn", { date: formatDate(r.sharedAt, locale) })}`} />
      <Card><CardContent className="pt-5"><BilingualText en={r.content} te={r.teReviewed ? r.contentTe : null} /></CardContent></Card>
    </>
  );
}
