import { redirect } from "next/navigation";
import { Target, CheckCircle2, Archive } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { careTeamOptions, getPlans } from "@/server/services/plans";
import { listServices } from "@/server/services/catalog";
import { setPlanStatusAction } from "@/server/actions/plans";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState, Field, SectionTitle } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { AddGoalDialog, NewPlanDialog, ReviewGoalDialog, ReviseGoalDialog } from "@/components/plans/plan-dialogs";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const { plans, team, services } = await withOrg(staffCtx(actor), async (tx) => ({
    plans: await getPlans(tx, actor, id),
    team: await careTeamOptions(tx, id),
    services: (await listServices(tx)).map((s) => ({ id: s.id, code: s.code })),
  }));
  const writable = access.canWriteClinical && child.status !== "archived";
  const canApprove = actor.permissions.includes("plans.approve");
  const defaultResponsible = team.some((m) => m.id === actor.staffId) ? actor.staffId : (team[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <SectionTitle action={writable ? <NewPlanDialog childId={id} /> : null}>{t("plans.title")}</SectionTitle>
      <Alert tone="info">{t("plans.noPrescriptionNotice")}</Alert>
      {plans.length === 0 && (
        <Card><EmptyState icon={Target} title={t("plans.empty")} description={t("plans.emptyHint")} /></Card>
      )}
      {plans.map((plan) => (
        <Card key={plan.id} data-testid="plan-card">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="text-lg">{plan.title}</CardTitle>
              <p className="mt-1 text-sm text-muted">
                {formatDate(plan.startDate, locale)} → {formatDate(plan.reviewDate, locale)}
                {plan.approverName ? ` · ${t("plans.approvedBy", { name: plan.approverName })}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={plan.status === "active" ? "success" : plan.status === "closed" ? "neutral" : "warning"}>{t(`enum.planStatus.${plan.status}`)}</Badge>
              {writable && canApprove && plan.status === "draft" && (
                <ConfirmActionButton label={t("plans.activate")} action={setPlanStatusAction.bind(null, { planId: plan.id, status: "active" })} variant="accent" icon={<CheckCircle2 />} />
              )}
              {writable && canApprove && plan.status !== "closed" && plan.status !== "draft" && (
                <ConfirmActionButton label={t("plans.closePlan")} confirmText={t("plans.closePlan")} action={setPlanStatusAction.bind(null, { planId: plan.id, status: "closed" })} variant="secondary" icon={<Archive />} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.familyPriorities && <Field label={t("plans.familyPriorities")}>{plan.familyPriorities}</Field>}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-500">{t("plans.goals")}</h3>
              {writable && plan.status !== "closed" && (
                <AddGoalDialog planId={plan.id} reviewDate={plan.reviewDate} defaultResponsible={defaultResponsible} team={team} services={services} />
              )}
            </div>
            {plan.goals.length === 0 ? (
              <p className="text-sm text-muted">{t("plans.noGoals")}</p>
            ) : (
              <ol className="space-y-3">
                {plan.goals.map((g, i) => (
                  <li key={g.id} className="rounded-xl border border-line p-4" data-testid="goal-item">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-teal-700">
                          {i + 1}. {t(`enum.domain.${g.domain}`)}{g.serviceCode ? ` · ${t(`enum.service.${g.serviceCode}`)}` : ""} · {t("plans.version", { v: g.version })}
                        </p>
                        <p className="mt-0.5 font-semibold text-ink">{g.title}</p>
                      </div>
                      <StatusBadge kind="goal" status={g.status} t={t} />
                    </div>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label={t("plans.baseline")}>{g.baseline}</Field>
                      <Field label={t("plans.target")}>{g.target}{g.targetPercent ? ` (${g.targetPercent}%)` : ""}</Field>
                      <Field label={t("plans.measurementMethod")}>{g.measurementMethod}</Field>
                      <Field label={t("plans.strategies")}>{g.strategies}</Field>
                      <Field label={t("plans.responsible")}>{g.responsibleName}</Field>
                      <Field label={t("plans.reviewDate")}>{formatDate(g.reviewDate, locale)}</Field>
                    </dl>
                    {writable && g.canChange && plan.status !== "closed" && (
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                        <ReviseGoalDialog
                          team={team}
                          services={services}
                          goal={{ goalId: g.id, domain: g.domain, serviceId: g.serviceId ?? "", title: g.title, baseline: g.baseline, target: g.target, measurementMethod: g.measurementMethod, targetPercent: g.targetPercent?.toString() ?? "", strategies: g.strategies, responsibleStaffId: g.responsibleStaffId, reviewDate: g.reviewDate, status: g.status }}
                        />
                        <ReviewGoalDialog goalId={g.id} status={g.status} />
                      </div>
                    )}
                    {(g.reviews.length > 0 || g.history.length > 0) && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-medium text-navy-600">{t("plans.history")} ({g.history.length + g.reviews.length})</summary>
                        <ul className="mt-2 space-y-2 border-l-2 border-line pl-3">
                          {g.reviews.map((r) => (
                            <li key={r.id}>
                              <p className="text-xs text-muted">{formatDate(r.reviewedOn, locale)} · {r.reviewerName} · {t(`enum.goalStatus.${r.statusBefore}`)} → {t(`enum.goalStatus.${r.statusAfter}`)}</p>
                              <p className="text-ink">{r.summary}</p>
                            </li>
                          ))}
                          {g.history.map((h) => (
                            <li key={h.id}>
                              <p className="text-xs text-muted">{t("plans.version", { v: h.version })} · {formatDate(h.createdAt, locale)} · {h.responsibleName}</p>
                              <p className="text-ink">{h.title} — {h.target}</p>
                              {h.revisionReason && <p className="text-xs text-muted">{h.revisionReason}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
