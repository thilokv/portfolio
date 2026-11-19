import { requireStaffPage } from "@/server/auth/actor";
import { getT } from "@/i18n/server";
import { AppShell, type NavGroup, type NavItem } from "@/components/layout/app-shell";
import { ChangePasswordCard } from "@/components/change-password-card";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaffPage();
  const t = await getT();
  const has = (p: string) => actor.permissions.includes(p as never);

  const main: NavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: "dashboard" },
    { href: "/children", label: t("nav.children"), icon: "children" },
    { href: "/schedule", label: t("nav.schedule"), icon: "schedule" },
  ];
  if (has("clinical.view")) main.push({ href: "/sessions", label: t("nav.sessions"), icon: "sessions" });
  if (has("clinical.view") || has("reports.operational")) main.push({ href: "/reports", label: t("nav.reports"), icon: "reports" });
  if (has("ai.use")) main.push({ href: "/assistant", label: t("nav.assistant"), icon: "assistant" });

  const admin: NavItem[] = [];
  if (has("staff.manage")) admin.push({ href: "/admin/staff", label: t("nav.staff"), icon: "staff" });
  if (has("services.manage")) admin.push({ href: "/admin/services", label: t("nav.services"), icon: "services" });
  if (has("consent.manage")) admin.push({ href: "/admin/consents", label: t("nav.consents"), icon: "consents" });
  if (has("audit.view")) admin.push({ href: "/admin/audit", label: t("nav.audit"), icon: "audit" });
  if (has("data.export")) admin.push({ href: "/admin/export", label: t("nav.exports"), icon: "exports" });

  const groups: NavGroup[] = [{ items: main }];
  if (admin.length) groups.push({ label: t("nav.admin"), items: admin });
  groups.push({ items: [{ href: "/settings", label: t("nav.settings"), icon: "settings" }] });

  const bottomNav: NavItem[] = main.slice(0, 4);
  if (bottomNav.length < 4) bottomNav.push({ href: "/settings", label: t("nav.settings"), icon: "settings" });

  return (
    <AppShell
      groups={groups}
      bottomNav={bottomNav}
      homeHref="/dashboard"
      user={{ name: actor.name, subtitle: actor.roles.map((r) => t(`enum.role.${r}`)).join(", ") }}
    >
      {actor.mustChangePassword ? <ChangePasswordCard mustChange /> : children}
    </AppShell>
  );
}
