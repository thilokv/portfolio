import { redirect } from "next/navigation";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listAudit } from "@/server/services/audit-log";
import { getLocale, getT } from "@/i18n/server";
import { SectionTitle } from "@/components/ui/misc";
import { AuditTable } from "@/components/audit/audit-table";

export default async function ChildAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access, actor } = await loadChild(id);
  if (!access.canViewAudit) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(staffCtx(actor), (tx) => listAudit(tx, actor, { childId: id, limit: 200 }));
  return (
    <div>
      <SectionTitle>{t("audit.recordHistory")}</SectionTitle>
      <AuditTable rows={rows} t={t} locale={locale} />
    </div>
  );
}
