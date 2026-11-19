import { withOrg } from "@/db";
import { guardianCtx, requireGuardianPage } from "@/server/auth/actor";
import { portalProfile } from "@/server/services/portal";
import { getT } from "@/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, PageHeader } from "@/components/ui/misc";
import { ContactForm } from "@/components/portal/portal-forms";
import { ChangePasswordCard } from "@/components/change-password-card";
import { SettingsLanguage } from "@/components/settings-language";

export default async function PortalProfilePage() {
  const actor = await requireGuardianPage();
  const t = await getT();
  const g = await withOrg(guardianCtx(actor), (tx) => portalProfile(tx, actor));
  return (
    <>
      <PageHeader title={t("portal.contactDetails")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{g.fullName}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("auth.email")}>{actor.email}</Field>
            <Field label={t("settings.language")}><SettingsLanguage /></Field>
            <ContactForm initial={{ phone: g.phone, alternatePhone: g.alternatePhone ?? "", address: g.address ?? "", preferredLanguage: g.preferredLanguage }} />
          </CardContent>
        </Card>
        <ChangePasswordCard />
      </div>
    </>
  );
}
