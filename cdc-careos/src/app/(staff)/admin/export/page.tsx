import type { Metadata } from "next";
import { Download, DatabaseBackup } from "lucide-react";
import { requireStaffPage } from "@/server/auth/actor";
import { DATASETS } from "@/server/services/export";
import { getT } from "@/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Data export" };

export default async function ExportPage() {
  await requireStaffPage("data.export");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("admin.exportTitle")} description={t("admin.exportSubtitle")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("admin.exportCsv")}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {DATASETS.map((d) => (
              <a key={d} href={`/api/export/${d}`} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm font-medium capitalize hover:bg-navy-50">
                {d} <Download className="size-4 text-navy-400" />
              </a>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-4 text-teal-600" /> {t("admin.backupTitle")}</CardTitle></CardHeader>
          <CardContent><Alert tone="info">{t("admin.backupBody")}</Alert></CardContent>
        </Card>
      </div>
    </>
  );
}
