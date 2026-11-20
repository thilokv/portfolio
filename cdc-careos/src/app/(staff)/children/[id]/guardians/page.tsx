import { Phone, Mail, ShieldCheck } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { hasConsent, listGuardians } from "@/server/services/children";
import { getT } from "@/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, SectionTitle } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { AddGuardianDialog, EnablePortalButton } from "@/components/children/guardian-actions";

export default async function GuardiansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  const t = await getT();
  const { guardians, portalConsent } = await withOrg(staffCtx(actor), async (tx) => ({
    guardians: await listGuardians(tx, actor, id),
    portalConsent: await hasConsent(tx, id, "parent_portal"),
  }));
  const editable = access.canEditProfile && child.status !== "archived";
  return (
    <div className="space-y-4">
      <SectionTitle action={editable ? <AddGuardianDialog childId={id} /> : null}>{t("children.profileTabs.guardians")}</SectionTitle>
      {access.canManageConsent && !portalConsent && <Alert tone="info">{t("children.portalNeedsConsent")}</Alert>}
      {guardians.length === 0 ? (
        <Card><EmptyState title={t("common.noData")} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {guardians.map((g) => (
            <Card key={g.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={g.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{g.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{t(`enum.relationship.${g.relationship}`)}</Badge>
                      {g.isPrimary && <Badge tone="teal">{t("children.primary")}</Badge>}
                      {g.hasLegalAuthority && <Badge tone="blue">{t("children.legalAuthority")}</Badge>}
                      {g.portalAccess && <Badge tone="success"><ShieldCheck className="size-3" /> {t("children.portalAccess")}</Badge>}
                    </div>
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm text-navy-700">
                  <li className="flex items-center gap-2"><Phone className="size-4 text-navy-300" aria-hidden /><a href={`tel:${g.phone}`} className="hover:underline">{g.phone}</a>{g.alternatePhone ? ` · ${g.alternatePhone}` : ""}</li>
                  <li className="flex items-center gap-2"><Mail className="size-4 text-navy-300" aria-hidden />{g.email ?? "—"}</li>
                  <li className="text-xs text-muted">{t("children.preferredLanguage")}: {t(`enum.language.${g.preferredLanguage}`)}</li>
                </ul>
                {access.canManageConsent && portalConsent && !g.portalAccess && child.status !== "archived" && (
                  g.email ? <EnablePortalButton childId={id} guardianId={g.id} /> : <p className="text-xs text-muted">{t("children.portalNeedsEmail")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
