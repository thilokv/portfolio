import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/actor";
import { getT } from "@/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, PageHeader } from "@/components/ui/misc";
import { ChangePasswordCard } from "@/components/change-password-card";
import { SettingsLanguage } from "@/components/settings-language";
import { SignOutOthers } from "@/components/sign-out-others";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireStaffPage();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("settings.profile")}</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <Field label={t("admin.fullName")}>{actor.name}</Field>
              <Field label={t("admin.email")}>{actor.email}</Field>
              <Field label={t("admin.roles")}>
                <span className="flex flex-wrap gap-1">{actor.roles.map((r) => <Badge key={r} tone="teal">{t(`enum.role.${r}`)}</Badge>)}</span>
              </Field>
              <Field label={t("settings.language")}><SettingsLanguage /></Field>
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <ChangePasswordCard />
          <Card>
            <CardHeader><CardTitle>{t("settings.security")}</CardTitle></CardHeader>
            <CardContent><SignOutOthers /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
