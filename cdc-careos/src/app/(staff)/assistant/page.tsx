import type { Metadata } from "next";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listChildren } from "@/server/services/children";
import { myRecentDrafts } from "@/server/services/ai";
import { getProvider } from "@/server/ai/providers";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { AiAssistant } from "@/components/ai-assistant";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AssistantPage() {
  const actor = await requireStaffPage("ai.use");
  const [t, locale] = [await getT(), await getLocale()];
  const provider = getProvider();
  const { kids, drafts } = await withOrg(staffCtx(actor), async (tx) => ({
    kids: (await listChildren(tx, actor, { status: "active" })).rows,
    drafts: await myRecentDrafts(tx, actor),
  }));
  return (
    <>
      <PageHeader title={t("ai.title")} description={t("ai.subtitle")} />
      <div className="mb-4 space-y-2">
        <Alert tone={provider.name === "mock" ? "info" : "warning"}>
          {provider.name === "mock" ? t("ai.providerMock") : t("ai.providerReal", { name: provider.name })}
        </Alert>
        <Alert tone="warning">{t("ai.rules")}</Alert>
      </div>
      <AiAssistant childrenOptions={kids.map((k) => ({ id: k.id, label: `${k.childCode}` }))} />
      <Card className="mt-4">
        <CardHeader><CardTitle>{t("ai.history")}</CardTitle></CardHeader>
        <CardContent>
          {drafts.length === 0 ? <p className="text-sm text-muted">{t("common.noData")}</p> : (
            <ul className="divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>{t(`ai.features.${d.feature}`)} · <span className="text-muted">{d.provider} · {formatDateTime(d.createdAt, locale)}</span></span>
                  <Badge tone={d.status === "accepted" ? "success" : d.status === "discarded" ? "neutral" : "warning"}>{d.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
