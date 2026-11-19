import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { markMessagesRead, portalChildren, portalMessages } from "@/server/services/portal";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { BilingualText } from "@/components/portal/bilingual-text";
import { FeedbackForm } from "@/components/portal/portal-forms";

export default async function PortalMessagesPage() {
  const actor = await requireGuardianPage();
  const [t, locale] = [await getT(), await getLocale()];
  const { rows, kids } = await withOrg(guardianCtx(actor), async (tx) => {
    const list = await portalMessages(tx, actor);
    await markMessagesRead(tx, actor, list.filter((r) => r.m.direction === "to_guardian").map((r) => r.m.id));
    return { rows: list, kids: await portalChildren(tx, actor) };
  });
  return (
    <>
      <PageHeader title={t("portal.messages")} />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardContent className="pt-5">
            {rows.length === 0 ? <p className="text-sm text-muted">{t("portal.noMessages")}</p> : (
              <ul className="space-y-3">
                {rows.map(({ m, staffName, childName }) => (
                  <li key={m.id} className={`rounded-xl border p-3 ${m.direction === "from_guardian" ? "ml-6 border-teal-100 bg-teal-50/50" : "mr-6 border-line"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={m.direction === "from_guardian" ? "teal" : "blue"}>{t(`enum.messageKind.${m.kind}`)}</Badge>
                      <span className="text-xs text-muted">{formatDateTime(m.createdAt, locale)}</span>
                    </div>
                    <p className="mt-2 font-medium text-ink">{m.subject}</p>
                    <div className="mt-1"><BilingualText en={m.body} te={m.teTranslationReviewedBy ? m.bodyTe : null} /></div>
                    <p className="mt-1 text-xs text-muted">{childName}{staffName ? ` · ${staffName}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle>{t("portal.sendFeedback")}</CardTitle></CardHeader>
          <CardContent>{kids.length ? <FeedbackForm childrenOptions={kids.map((k) => ({ id: k.id, name: k.preferredName ?? k.fullName }))} /> : <p className="text-sm text-muted">{t("portal.noChildren")}</p>}</CardContent>
        </Card>
      </div>
    </>
  );
}
