import type { Metadata } from "next";
import Link from "next/link";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { attendanceRate, monthlyOperations } from "@/server/services/reports-ops";
import { getT } from "@/i18n/server";
import { addDays, endOfMonth, isoDateIST, startOfMonth } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Table, Td, Th } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requireStaffPage();
  if (!actor.permissions.includes("clinical.view") && !actor.permissions.includes("reports.operational")) {
    const { redirect } = await import("next/navigation");
    redirect("/forbidden");
  }
  const t = await getT();
  const m = (await searchParams).month;
  const monthStart = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? `${m}-01` : startOfMonth(isoDateIST());
  const data = await withOrg(staffCtx(actor), (tx) => monthlyOperations(tx, actor, monthStart));
  const prev = addDays(monthStart, -1).slice(0, 7);
  const next = addDays(endOfMonth(monthStart), 1).slice(0, 7);
  const rate = attendanceRate(data.totals);

  const table = (title: string, rows: (Omit<(typeof data.byService)[number], "key"> & { key: string })[], label: (k: string) => string) => (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <Table>
        <thead>
          <tr><Th>{title}</Th><Th>{t("admin.scheduled")}</Th><Th>{t("admin.completed")}</Th><Th>{t("admin.noShow")}</Th><Th>{t("admin.cancelled")}</Th><Th>{t("admin.attendanceRate")}</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><Td colSpan={6} className="text-center text-muted">{t("common.noData")}</Td></tr>
          ) : (
            rows.map((r) => {
              const rr = attendanceRate(r);
              return (
                <tr key={r.key}>
                  <Td className="font-medium">{label(r.key)}</Td>
                  <Td className="tabular-nums">{r.scheduled}</Td>
                  <Td className="tabular-nums">{r.completed}</Td>
                  <Td className="tabular-nums">{r.noShow}</Td>
                  <Td className="tabular-nums">{r.cancelledFamily + r.cancelledCenter}</Td>
                  <Td className="tabular-nums">{rr == null ? "—" : `${rr}%`}</Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={data.all ? t("admin.reportsTitle") : t("nav.reports")}
        description={data.all ? t("dashboard.scopeAll") : t("dashboard.scopeMine")}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm"><Link href={`?month=${prev}`}>‹</Link></Button>
            <span className="text-sm font-semibold tabular-nums">{monthStart.slice(0, 7)}</span>
            <Button asChild variant="secondary" size="sm"><Link href={`?month=${next}`}>›</Link></Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("admin.scheduled")} value={data.totals.scheduled} />
        <StatCard label={t("admin.completed")} value={data.totals.completed} tone="teal" />
        <StatCard label={t("admin.noShow")} value={data.totals.noShow} tone="warning" />
        <StatCard label={t("admin.attendanceRate")} value={rate == null ? "—" : `${rate}%`} hint={t("admin.attendanceRateHint")} tone="blue" />
        <StatCard label={t("enum.sessionStatus.signed")} value={data.notes.signed} />
        <StatCard label={t("dashboard.pendingNotes")} value={data.notes.pending} tone={data.notes.pending ? "warning" : "navy"} />
        {data.kids && (
          <>
            <StatCard label={t("dashboard.activeChildren")} value={data.kids.active} tone="teal" />
            <StatCard label={t("enum.childStatus.waitlisted")} value={data.kids.waitlisted} tone="blue" />
          </>
        )}
      </div>
      <div className="mt-6 grid gap-4">
        {table(t("admin.byService"), data.byService, (k) => t(`enum.service.${k}`))}
        {data.all && table(t("admin.byTherapist"), data.byTherapist, (k) => k)}
      </div>
      <CardContent className="px-0 text-xs text-muted">{t("admin.attendanceRateHint")}</CardContent>
    </>
  );
}
