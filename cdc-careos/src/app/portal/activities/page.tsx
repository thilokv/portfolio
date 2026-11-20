import { Heart } from "lucide-react";
import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { markMessagesRead, portalMessages } from "@/server/services/portal";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { BilingualText } from "@/components/portal/bilingual-text";

export default async function PortalActivities() {
  const actor = await requireGuardianPage();
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(guardianCtx(actor), async (tx) => {
    const list = await portalMessages(tx, actor, "home_activity");
    await markMessagesRead(tx, actor, list.map((r) => r.m.id));
    return list;
  });
  return (
    <>
      <PageHeader title={t("portal.activities")} />
      {rows.length === 0 ? <Card><EmptyState icon={Heart} title={t("portal.noActivities")} /></Card> : (
        <div className="space-y-3">
          {rows.map(({ m, staffName, childName }) => (
            <Card key={m.id}>
              <CardContent className="pt-5">
                <p className="font-semibold text-ink">{m.subject}</p>
                <p className="mb-3 text-xs text-muted">{childName} · {staffName} · {formatDate(m.createdAt, locale)}</p>
                <BilingualText en={m.body} te={m.teTranslationReviewedBy ? m.bodyTe : null} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
