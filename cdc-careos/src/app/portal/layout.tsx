import { requireGuardianPage } from "@/server/auth/actor";
import { getT } from "@/i18n/server";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { ChangePasswordCard } from "@/components/change-password-card";
import { DemoNotice } from "@/components/demo-notice";
import { isDemoMode } from "@/lib/runtime-env";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireGuardianPage();
  const t = await getT();
  const items: NavItem[] = [
    { href: "/portal", label: t("nav.portalHome"), icon: "home" },
    { href: "/portal/appointments", label: t("nav.portalAppointments"), icon: "appointments" },
    { href: "/portal/reports", label: t("nav.portalReports"), icon: "portalReports" },
    { href: "/portal/activities", label: t("nav.portalActivities"), icon: "activities" },
    { href: "/portal/messages", label: t("nav.portalMessages"), icon: "messages" },
    { href: "/portal/profile", label: t("nav.portalProfile"), icon: "profile" },
  ];
  return (
    <AppShell groups={[{ items }]} bottomNav={[items[0], items[1], items[2], items[4]]} homeHref="/portal" notice={isDemoMode() ? <DemoNotice text={t("app.demoNotice")} /> : undefined} user={{ name: actor.name, subtitle: t("children.guardianSection") }}>
      {actor.mustChangePassword ? <ChangePasswordCard mustChange /> : children}
    </AppShell>
  );
}
