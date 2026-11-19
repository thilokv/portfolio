import type { Metadata } from "next";
import Link from "next/link";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listAudit } from "@/server/services/audit-log";
import { getLocale, getT } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { AuditTable } from "@/components/audit/audit-table";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; before?: string }> }) {
  const actor = await requireStaffPage("audit.view");
  const [t, locale] = [await getT(), await getLocale()];
  const sp = await searchParams;
  const before = sp.before && /^\d+$/.test(sp.before) ? Number(sp.before) : undefined;
  const action = sp.action?.slice(0, 60);
  const rows = await withOrg(staffCtx(actor), (tx) => listAudit(tx, actor, { action, before, limit: 50 }));
  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />
      <form className="mb-4 flex gap-2">
        <Input name="action" defaultValue={action ?? ""} placeholder={t("audit.filterAction")} className="max-w-xs" aria-label={t("audit.filterAction")} />
        <Button type="submit" variant="secondary">{t("common.filter")}</Button>
      </form>
      <AuditTable rows={rows} t={t} locale={locale} />
      {rows.length === 50 && (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="secondary" size="sm"><Link href={`?${new URLSearchParams({ ...(action ? { action } : {}), before: String(rows[rows.length - 1].id) })}`}>{t("common.next")}</Link></Button>
        </div>
      )}
    </>
  );
}
