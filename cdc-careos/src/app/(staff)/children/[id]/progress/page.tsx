import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart as LineIcon, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { getGoalProgress, periodSummary } from "@/server/services/progress";
import { getLocale, getT } from "@/i18n/server";
import { addDays, endOfMonth, formatDate, isoDateIST, startOfMonth, startOfWeek } from "@/lib/dates";
import { successRate, independentRate } from "@/lib/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/misc";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badges";
import { GoalChart } from "@/components/charts/goal-chart";
import { CreateReportDraftButton, RecordObservationDialog } from "@/components/progress/progress-actions";
import type { TranslateFn } from "@/i18n";

function Summary({ title, s, t, locale, action }: { title: string; s: Awaited<ReturnType<typeof periodSummary>>; t: TranslateFn; locale: string; action?: React.ReactNode }) {
  const items = [
    [t("progress.sessionsAttended"), s.attended],
    [t("progress.sessionsMissed"), s.missed],
    [t("progress.goalsWorkedOn"), s.goalsWorkedOn],
    [t("progress.observations", { n: "" }).trim(), s.observations],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted">{formatDate(s.from, locale)} – {formatDate(s.to, locale)}</p>
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export default async function ProgressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const today = isoDateIST();
  const monthParam = (await searchParams).month;
  const monthStart = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : startOfMonth(today);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(today);
  const { goals, week, month } = await withOrg(staffCtx(actor), async (tx) => ({
    goals: await getGoalProgress(tx, actor, id),
    week: await periodSummary(tx, id, weekStart, addDays(weekStart, 6)),
    month: await periodSummary(tx, id, monthStart, monthEnd),
  }));
  const prevMonth = addDays(monthStart, -1).slice(0, 7);
  const nextMonth = addDays(monthEnd, 1).slice(0, 7);
  const writable = access.canWriteClinical && child.status !== "archived";
  const TrendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus, insufficient: Info };

  return (
    <div className="space-y-4">
      <Alert tone="info" title={t("progress.subtitle")}>{t("progress.methodNote")}</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <Summary title={t("progress.weekly")} s={week} t={t} locale={locale} />
        <Summary
          title={t("progress.monthly")}
          s={month}
          t={t}
          locale={locale}
          action={
            <div className="flex items-center gap-1 text-xs">
              <Link className="rounded-lg px-2 py-1 hover:bg-navy-50" href={`?month=${prevMonth}`}>‹</Link>
              {monthStart.slice(0, 7)}
              {nextMonth <= today.slice(0, 7) && <Link className="rounded-lg px-2 py-1 hover:bg-navy-50" href={`?month=${nextMonth}`}>›</Link>}
              {writable && <CreateReportDraftButton childId={id} from={monthStart} to={monthEnd < today ? monthEnd : today} />}
            </div>
          }
        />
      </div>

      {goals.length === 0 ? (
        <Card><EmptyState icon={LineIcon} title={t("progress.noGoals")} /></Card>
      ) : (
        goals.map((g) => {
          const Icon = TrendIcon[g.trend];
          return (
            <Card key={g.id} data-testid="progress-goal">
              <CardHeader>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-teal-700">{t(`enum.domain.${g.domain}`)}{g.serviceCode ? ` · ${t(`enum.service.${g.serviceCode}`)}` : ""} · {g.responsibleName}</p>
                  <CardTitle className="mt-0.5">{g.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge kind="goal" status={g.status} t={t} />
                  {writable && g.canRecord && <RecordObservationDialog goalId={g.id} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted">{t("progress.baseline")}</dt><dd className="text-ink">{g.baseline}</dd></div>
                  <div><dt className="text-xs text-muted">{t("progress.target")}</dt><dd className="text-ink">{g.target}</dd></div>
                </dl>
                {g.observations.length === 0 ? (
                  <p className="rounded-xl bg-canvas p-4 text-sm text-muted">{t("progress.noObservations")}</p>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">{t("progress.successRate")}</p>
                        {g.points.length ? <GoalChart points={g.points} targetPercent={g.targetPercent} /> : <p className="py-10 text-center text-sm text-muted">{t("common.noData")}</p>}
                      </div>
                      <div className="space-y-2 rounded-xl bg-canvas p-4 text-sm">
                        <p className="flex items-center gap-2 font-medium text-ink"><Icon className="size-4 text-teal-600" aria-hidden /> {t("progress.trend")}</p>
                        <p className="text-navy-700">
                          {g.trend === "insufficient" ? t("progress.insufficientData") : t(`progress.trend${g.trend.charAt(0).toUpperCase()}${g.trend.slice(1)}`)}
                        </p>
                        <p className="text-xs text-muted">
                          {t("progress.observations", { n: g.observations.length })} · {t("progress.sessionsWithData", { n: g.measuredCount })}
                        </p>
                      </div>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-navy-600">{t("progress.observationTable")}</summary>
                      <Table className="mt-2">
                        <thead>
                          <tr>
                            <Th>{t("common.date")}</Th>
                            <Th>{t("sessions.trialsSuccessful")}</Th>
                            <Th>%</Th>
                            <Th>{t("progress.independentRate")}</Th>
                            <Th>{t("sessions.assistance")}</Th>
                            <Th>{t("common.notes")}</Th>
                            <Th>{t("common.by")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...g.observations].reverse().map((o) => {
                            const rate = successRate(o);
                            const ind = independentRate(o);
                            return (
                              <tr key={o.id}>
                                <Td className="whitespace-nowrap">{formatDate(o.observedOn, locale)}</Td>
                                <Td>{o.trialsTotal != null ? `${o.trialsSuccessful}/${o.trialsTotal}` : <span className="text-muted">{t("common.notRecorded")}</span>}</Td>
                                <Td className="tabular-nums">{rate != null ? `${rate}%` : "—"}</Td>
                                <Td className="tabular-nums">{ind != null ? `${ind}%` : "—"}</Td>
                                <Td>{o.assistanceLevel ? t(`enum.assistance.${o.assistanceLevel}`) : "—"}</Td>
                                <Td className="max-w-xs">{o.note ?? "—"}</Td>
                                <Td className="whitespace-nowrap text-muted">{o.observer}</Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
