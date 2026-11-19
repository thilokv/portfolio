import { notFound, redirect } from "next/navigation";
import { Lock, CheckCircle2 } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { getAssessment } from "@/server/services/assessments";
import { listServices } from "@/server/services/catalog";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { finalizeAssessmentAction } from "@/server/actions/assessments";
import { getLocale, getT } from "@/i18n/server";
import { ASSESSMENT_FORM_DOMAINS, SERVICE_ROLES, type ServiceCode } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/misc";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { ConfirmActionButton } from "@/components/confirm-action-button";

export default async function AssessmentPage({ params, searchParams }: { params: Promise<{ id: string; aid: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id, aid } = await params;
  const { edit } = await searchParams;
  const { access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  let a;
  try {
    a = await withOrg(staffCtx(actor), (tx) => getAssessment(tx, actor, aid));
  } catch (e) {
    if (e instanceof ForbiddenError) return <Alert tone="danger" title={t("common.restricted")}>{t("common.restrictedHint")}</Alert>;
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (a.childId !== id) notFound();

  if (edit && a.canEdit) {
    const services = (await withOrg(staffCtx(actor), (tx) => listServices(tx))).filter((s) => actor.roles.some((r) => SERVICE_ROLES[s.code as ServiceCode].includes(r)));
    const byDomain = new Map(a.domains.map((d) => [d.domain, d]));
    return (
      <div className="mx-auto max-w-3xl">
        <AssessmentForm
          roles={actor.roles.filter((r) => r !== "admin")}
          services={services.map((s) => ({ id: s.id, code: s.code }))}
          canRestrict={access.canViewRestricted}
          initial={{
            id: a.id,
            childId: id,
            serviceId: a.serviceId ?? "",
            assessorRole: a.assessorRole,
            assessmentDate: a.assessmentDate,
            toolName: a.toolName,
            toolVersion: a.toolVersion ?? "",
            reasonForAssessment: a.reasonForAssessment ?? "",
            overallObservations: a.overallObservations ?? "",
            recommendations: a.recommendations ?? "",
            reviewDate: a.reviewDate ?? "",
            isRestricted: a.isRestricted,
            domains: ASSESSMENT_FORM_DOMAINS.map((domain) => ({ domain, findings: byDomain.get(domain)?.findings ?? "", observations: byDomain.get(domain)?.observations ?? "" })),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">{a.toolName}{a.toolVersion ? ` (${a.toolVersion})` : ""}</CardTitle>
            <p className="mt-1 text-sm text-muted">{formatDate(a.assessmentDate, locale)} · {a.assessorName} · {t(`enum.role.${a.assessorRole}`)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.isRestricted && <Badge tone="warning"><Lock className="size-3" /> {t("assessments.restrictedLabel")}</Badge>}
            <Badge tone={a.status === "finalized" ? "success" : "neutral"}>{t(`enum.recordStatus.${a.status}`)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field label={t("assessments.qualifications")}>{a.assessorQualifications ?? "—"}</Field>
            <Field label={t("assessments.service")}>{a.serviceCode ? t(`enum.service.${a.serviceCode}`) : "—"}</Field>
            <Field label={t("assessments.reviewDate")}>{formatDate(a.reviewDate, locale)}</Field>
            <Field label={t("assessments.reason")} className="sm:col-span-3">{a.reasonForAssessment ?? "—"}</Field>
          </dl>
          {a.canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="?edit=1" className="inline-flex h-8 items-center rounded-xl border border-line px-3 text-xs font-semibold hover:bg-navy-50">{t("common.edit")}</a>
              <ConfirmActionButton label={t("assessments.finalize")} confirmText={t("assessments.finalizeConfirm")} action={finalizeAssessmentAction.bind(null, a.id)} icon={<CheckCircle2 />} variant="accent" />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("assessments.domainsTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ASSESSMENT_FORM_DOMAINS.map((domain) => {
            const d = a.domains.find((x) => x.domain === domain);
            return (
              <div key={domain} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-ink">{t(`enum.domain.${domain}`)}</p>
                {d ? (
                  <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Field label={t("assessments.findings")}>{d.findings ?? "—"}</Field>
                    <Field label={t("assessments.observations")}>{d.observations ?? "—"}</Field>
                  </dl>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t("assessments.notAssessed")}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <dl className="grid gap-4">
            <Field label={t("assessments.overall")}>{a.overallObservations ?? "—"}</Field>
            <Field label={t("assessments.recommendations")}>{a.recommendations ?? "—"}</Field>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
