import type { Metadata } from "next";
import Link from "next/link";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listSessions } from "@/server/services/scheduling";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/misc";
import { SessionList } from "@/components/sessions/session-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const actor = await requireStaffPage("clinical.view");
  const [t, locale] = [await getT(), await getLocale()];
  const view = (await searchParams).view ?? "pending";
  const rows = await withOrg(staffCtx(actor), (tx) =>
    listSessions(tx, actor, { pendingOnly: view === "pending", mine: view !== "all" }),
  );
  const tabs = [
    { key: "pending", label: t("sessions.pending") },
    { key: "mine", label: t("sessions.mine") },
    ...(actor.permissions.includes("children.view_all") ? [{ key: "all", label: t("common.all") }] : []),
  ];
  return (
    <>
      <PageHeader title={t("sessions.title")} description={t("sessions.subtitle")} />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
        {tabs.map((tab) => (
          <Link key={tab.key} href={`/sessions?view=${tab.key}`} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", view === tab.key ? "bg-navy-800 text-white" : "text-navy-500 hover:bg-navy-50")}>
            {tab.label}
          </Link>
        ))}
      </div>
      <SessionList rows={rows} t={t} locale={locale} />
    </>
  );
}
