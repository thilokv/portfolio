import Link from "next/link";
import { CalendarDays, Target, ClipboardList } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { getChildOverview } from "@/server/services/overview";
import { latestConsents, listCareTeam, listClinicalStaff, listGuardians } from "@/server/services/children";
import { listServices } from "@/server/services/catalog";
import { getLocale, getT } from "@/i18n/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { CareTeam } from "@/components/children/care-team";
import { ConsentPanel } from "@/components/children/consent-panel";

export default async function ChildOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  const [t, locale] = [await getT(), await getLocale()];
  const data = await withOrg(staffCtx(actor), async (tx) => ({
    overview: await getChildOverview(tx, id, access),
    team: await listCareTeam(tx, id),
    consents: await latestConsents(tx, id),
    guardians: await listGuardians(tx, actor, id),
    staffOptions: access.canManageCareTeam ? await listClinicalStaff(tx) : [],
    services: access.canManageCareTeam ? await listServices(tx) : [],
  }));
  const { overview } = data;
  const primary = data.guardians.find((g) => g.isPrimary) ?? data.guardians[0];
  const archived = child.status === "archived";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-muted"><CalendarDays className="size-4 text-sky-600" aria-hidden />{t("children.nextAppointment")}</p>
          {overview.nextAppt ? (
            <>
              <p className="mt-2 font-semibold text-ink">{formatDateTime(overview.nextAppt.startsAt, locale)}</p>
              <p className="text-xs text-muted">{t(`enum.service.${overview.nextAppt.serviceCode}`)} · {overview.nextAppt.staffName}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("children.noUpcoming")}</p>
          )}
        </Card>
        {access.canViewClinical && (
          <>
            <Card className="p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-muted"><Target className="size-4 text-teal-600" aria-hidden />{t("children.activeGoals")}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{overview.activeGoals}</p>
              <Link href={`/children/${id}/plan`} className="text-xs font-medium text-teal-700 hover:underline">{t("common.view")}</Link>
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-muted"><ClipboardList className="size-4 text-navy-500" aria-hidden />{t("children.lastSession")}</p>
              {overview.lastSession ? (
                <Link href={`/sessions/${overview.lastSession.id}`} className="mt-2 block">
                  <span className="block font-semibold text-ink">{formatDate(overview.lastSession.sessionDate, locale)}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {t(`enum.service.${overview.lastSession.serviceCode}`)} <StatusBadge kind="session" status={overview.lastSession.status} t={t} />
                  </span>
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("common.noData")}</p>
              )}
            </Card>
          </>
        )}
      </div>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{t("common.details")}</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t("children.dob")}>{formatDate(child.dateOfBirth, locale)}</Field>
            <Field label={t("children.sex")}>{child.sex ? t(`enum.sex.${child.sex}`) : "—"}</Field>
            <Field label={t("children.registrationDate")}>{formatDate(child.registrationDate, locale)}</Field>
            <Field label={t("children.referralSource")}>{child.referralSource ?? "—"}</Field>
            <Field label={t("children.guardianSection")}>
              {primary ? `${primary.fullName} (${t(`enum.relationship.${primary.relationship}`)}) · ${primary.phone}` : "—"}
            </Field>
            <Field label={t("children.emergencyContact")}>
              {child.emergencyContactName ? `${child.emergencyContactName}${child.emergencyContactRelation ? ` (${child.emergencyContactRelation})` : ""} · ${child.emergencyContactPhone ?? ""}` : "—"}
            </Field>
            <Field label={t("children.address")} className="sm:col-span-2">{child.address ?? "—"}</Field>
            <Field label={t("children.parentConcerns")} className="sm:col-span-2">{child.parentConcerns ?? "—"}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("children.careTeam")}</CardTitle></CardHeader>
        <CardContent>
          <CareTeam
            childId={id}
            team={data.team}
            canManage={access.canManageCareTeam && !archived}
            staffOptions={data.staffOptions}
            serviceOptions={data.services.map((s) => ({ id: s.id, code: s.code }))}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader><CardTitle>{t("children.consents")}</CardTitle></CardHeader>
        <CardContent>
          <ConsentPanel
            childId={id}
            latest={Object.fromEntries(data.consents.latest)}
            guardians={data.guardians.map((g) => ({ id: g.id, fullName: g.fullName }))}
            canManage={access.canManageConsent && !archived}
          />
        </CardContent>
      </Card>
    </div>
  );
}
