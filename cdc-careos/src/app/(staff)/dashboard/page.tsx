import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ClipboardPen,
  FileClock,
  Users,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { getDashboard } from "@/server/services/dashboard";
import { getLocale, getT } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard, Avatar } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { WeekChart } from "@/components/charts/week-chart";
import { formatDate, formatTime, formatWeekday, isoDateIST } from "@/lib/dates";
import { humanizeAction } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireStaffPage();
  const [t, locale] = [await getT(), await getLocale()];
  const d = await withOrg(staffCtx(actor), (tx) => getDashboard(tx, actor));
  const firstName = actor.name.replace(/^Dr\.?\s+/, "").split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={formatWeekday(isoDateIST(), locale)}
        title={t("dashboard.greeting", { name: firstName })}
        description={`${t("dashboard.subtitle")} ${d.scopeAll ? t("dashboard.scopeAll") : t("dashboard.scopeMine")}`}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6" aria-label="Key figures">
        <StatCard label={t("dashboard.totalChildren")} value={d.totals.total} icon={Users} />
        <StatCard label={t("dashboard.activeChildren")} value={d.totals.active} icon={UserCheck} tone="teal" />
        <StatCard label={t("dashboard.todaysAppointments")} value={d.totals.todayAppts} icon={CalendarDays} tone="blue" />
        <StatCard label={t("dashboard.completedSessions")} value={d.totals.completedToday} icon={CalendarCheck2} tone="teal" />
        <StatCard label={t("dashboard.pendingNotes")} value={d.totals.pendingNotes} icon={ClipboardPen} tone={d.totals.pendingNotes ? "warning" : "navy"} />
        <StatCard label={t("dashboard.upcomingReviews")} value={d.totals.reviews} icon={CalendarClock} tone="blue" />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("dashboard.myDay")}</CardTitle>
            </div>
            <Link href="/schedule" className="text-sm font-medium text-teal-700 hover:underline">{t("common.viewAll")}</Link>
          </CardHeader>
          <CardContent>
            {d.myDay.length === 0 ? (
              <EmptyState icon={CalendarDays} title={t("dashboard.noAppointmentsToday")} className="py-6" />
            ) : (
              <ul className="divide-y divide-line">
                {d.myDay.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">{formatTime(a.startsAt, locale)}</div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/children/${a.childId}`} className="block truncate font-medium text-ink hover:text-teal-700">
                        {a.childName}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {a.childCode} · {t(`enum.service.${a.serviceCode}`)}{a.room ? ` · ${a.room}` : ""}
                      </p>
                    </div>
                    <StatusBadge kind="appointment" status={a.status} t={t} />
                    <Link
                      href={a.sessionId ? `/sessions/${a.sessionId}` : `/schedule?date=${isoDateIST()}`}
                      className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-ink"
                      aria-label={a.sessionId ? t("schedule.openSession") : t("common.view")}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.staffAvailability")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.availability.length === 0 ? (
              <p className="text-sm text-muted">{t("common.noData")}</p>
            ) : (
              <ul className="space-y-2.5">
                {d.availability.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <Avatar name={s.name} className="size-8 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.name}</span>
                    {s.status ? (
                      <Badge tone="warning">{t(`enum.availability.${s.status}`)}</Badge>
                    ) : (
                      <Badge tone="success">{t("dashboard.appointmentsCount", { n: s.appointments })}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.pendingNotesList")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.pendingNotes.length === 0 ? (
              <EmptyState icon={FileClock} title={t("dashboard.noPendingNotes")} className="py-4" />
            ) : (
              <ul className="space-y-2">
                {d.pendingNotes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sessions/${s.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-navy-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{s.childName}</span>
                        <span className="block truncate text-xs text-muted">
                          {formatDate(s.sessionDate, locale)} · {t(`enum.service.${s.serviceCode}`)} · {s.therapist}
                        </span>
                      </span>
                      <StatusBadge kind="session" status={s.status} t={t} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.reviewsDue")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.reviews.length === 0 ? (
              <p className="text-sm text-muted">{t("dashboard.noReviews")}</p>
            ) : (
              <ul className="space-y-2">
                {d.reviews.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link href={`/children/${r.childId}/plan`} className="block rounded-xl px-2 py-2 hover:bg-navy-50">
                      <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {r.childName} · {formatDate(r.reviewDate, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("dashboard.weeklyAttendance")}</CardTitle>
              <CardDescription>{d.scopeAll ? t("dashboard.scopeAll") : t("dashboard.scopeMine")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <WeekChart data={d.week} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.activity.length === 0 ? (
              <p className="text-sm text-muted">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{humanizeAction(a.action)}</span>
                      {a.summary && <span className="text-muted"> — {a.summary}</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {a.actorName} · {formatDate(a.createdAt, locale)} {formatTime(a.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
