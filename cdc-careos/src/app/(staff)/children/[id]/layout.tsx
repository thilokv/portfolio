import { loadChild } from "@/server/loaders";
import { getT } from "@/i18n/server";
import { formatAge } from "@/lib/dates";
import { Avatar } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges";
import { ProfileTabs } from "@/components/children/profile-tabs";
import { ChildHeaderActions } from "@/components/children/child-header-actions";

export default async function ChildLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  const t = await getT();
  const tabs = [
    { slug: "", label: t("children.profileTabs.overview") },
    { slug: "guardians", label: t("children.profileTabs.guardians") },
    { slug: "history", label: t("children.profileTabs.history") },
    ...(access.canViewClinical
      ? [
          { slug: "assessments", label: t("children.profileTabs.assessments") },
          { slug: "plan", label: t("children.profileTabs.plan") },
          { slug: "sessions", label: t("children.profileTabs.sessions") },
          { slug: "progress", label: t("children.profileTabs.progress") },
        ]
      : []),
    { slug: "documents", label: t("children.profileTabs.documents") },
    ...(access.canViewClinical ? [{ slug: "communication", label: t("children.profileTabs.communication") }] : []),
    ...(access.canViewAudit ? [{ slug: "audit", label: t("children.profileTabs.audit") }] : []),
  ];
  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={child.fullName} className="size-14 text-lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{child.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone="navy" className="tabular-nums">{child.childCode}</Badge>
              <span>{formatAge(child.dateOfBirth, t)}</span>
              <span aria-hidden>·</span>
              <span>{t(`enum.language.${child.preferredLanguage}`)}</span>
              <StatusBadge kind="child" status={child.status} t={t} />
            </div>
          </div>
        </div>
        <ChildHeaderActions
          childId={child.id}
          archived={child.status === "archived"}
          canEdit={access.canEditProfile}
          canArchive={actor.permissions.includes("children.archive")}
        />
      </div>
      {child.status === "archived" && <Alert tone="warning" className="mb-4">{t("children.archivedBanner")}</Alert>}
      <ProfileTabs base={`/children/${child.id}`} tabs={tabs} />
      <div className="pt-5">{children}</div>
    </div>
  );
}
