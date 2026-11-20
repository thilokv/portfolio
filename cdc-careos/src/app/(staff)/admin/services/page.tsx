import type { Metadata } from "next";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listServices } from "@/server/services/catalog";
import { getT } from "@/i18n/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { ServiceDialog } from "@/components/admin/service-dialog";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const actor = await requireStaffPage("services.manage");
  const t = await getT();
  const rows = await withOrg(staffCtx(actor), (tx) => listServices(tx, false));
  return (
    <>
      <PageHeader title={t("admin.servicesTitle")} description={t("admin.servicesSubtitle")} />
      <Card>
        <ul className="divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{s.name} {s.nameTe && <span lang="te" className="font-normal text-muted">· {s.nameTe}</span>}</p>
                <p className="text-xs text-muted">{s.defaultDurationMinutes} min{s.description ? ` · ${s.description}` : ""}</p>
              </div>
              <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? t("admin.active") : t("admin.inactive")}</Badge>
              <ServiceDialog initial={{ id: s.id, name: s.name, nameTe: s.nameTe ?? "", description: s.description ?? "", defaultDurationMinutes: String(s.defaultDurationMinutes), isActive: s.isActive }} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
