import { loadChild } from "@/server/loaders";
import { getT } from "@/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child } = await loadChild(id);
  const t = await getT();
  const sections = [
    ["children.developmentalHistory", child.developmentalHistory],
    ["children.parentConcerns", child.parentConcerns],
    ["children.medicalHistory", child.medicalHistory],
    ["children.existingReports", child.existingReportsSummary],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map(([key, value]) => (
        <Card key={key}>
          <CardHeader><CardTitle>{t(key)}</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{value ?? <span className="text-muted">{t("common.notRecorded")}</span>}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
