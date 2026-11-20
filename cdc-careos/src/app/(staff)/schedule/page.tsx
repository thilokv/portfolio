import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { withOrg } from "@/db";
import { can, requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listDay } from "@/server/services/scheduling";
import { listClinicalStaff } from "@/server/services/children";
import { getLocale, getT } from "@/i18n/server";
import { addDays, formatTime, formatWeekday, isoDateIST } from "@/lib/dates";
import { isValidDate } from "@/lib/validation/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { AppointmentActions } from "@/components/schedule/appointment-actions";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; staff?: string }> }) {
  const actor = await requireStaffPage();
  const [t, locale] = [await getT(), await getLocale()];
  const sp = await searchParams;
  const date = sp.date && isValidDate(sp.date) ? sp.date : isoDateIST();
  const manageAll = can(actor, "appointments.manage_all");
  const staffFilter = sp.staff === "me" ? actor.staffId : sp.staff && /^[0-9a-f-]{36}$/.test(sp.staff) ? sp.staff : undefined;
  const { rows, staffList } = await withOrg(staffCtx(actor), async (tx) => ({
    rows: await listDay(tx, actor, date, { staffId: staffFilter }),
    staffList: manageAll ? await listClinicalStaff(tx) : [],
  }));
  const link = (d: string) => `/schedule?date=${d}${sp.staff ? `&staff=${sp.staff}` : ""}`;
  const canCreate = manageAll || can(actor, "appointments.manage_own");

  return (
    <>
      <PageHeader
        title={t("schedule.title")}
        description={t("schedule.subtitle")}
        actions={canCreate ? <Button asChild variant="accent"><Link href={`/schedule/new?date=${date}`}><Plus /> {t("schedule.new")}</Link></Button> : null}
      />
      <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon"><Link href={link(addDays(date, -1))} aria-label={t("schedule.prevDay")}><ChevronLeft /></Link></Button>
          <div className="min-w-0 px-1 text-center">
            <p className="font-semibold text-ink">{formatWeekday(date, locale)}</p>
          </div>
          <Button asChild variant="ghost" size="icon"><Link href={link(addDays(date, 1))} aria-label={t("schedule.nextDay")}><ChevronRight /></Link></Button>
          {date !== isoDateIST() && <Button asChild variant="secondary" size="sm"><Link href={link(isoDateIST())}>{t("common.today")}</Link></Button>}
        </div>
        <form className="flex flex-wrap gap-2">
          <Input type="date" name="date" defaultValue={date} className="h-9 w-auto" aria-label={t("common.date")} />
          {manageAll && (
            <Select name="staff" defaultValue={sp.staff ?? ""} className="h-9 w-auto" aria-label={t("schedule.filterTherapist")}>
              <option value="">{t("schedule.allTherapists")}</option>
              <option value="me">{t("schedule.mine")}</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          )}
          <Button type="submit" size="sm" variant="secondary" className="h-9">{t("common.filter")}</Button>
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("schedule.empty")} />
        ) : (
          <ul className="divide-y divide-line" data-testid="schedule-list">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="w-16 shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-ink">{formatTime(a.startsAt, locale)}</p>
                    <p className="text-xs tabular-nums text-muted">{formatTime(a.endsAt, locale)}</p>
                  </div>
                  <div className="min-w-0">
                    <Link href={`/children/${a.childId}`} className="font-semibold text-ink hover:text-teal-700">{a.childName}</Link>
                    <p className="text-xs text-muted">
                      {a.childCode} · {t(`enum.service.${a.serviceCode}`)} · {a.staffName}{a.room ? ` · ${a.room}` : ""}
                    </p>
                    {a.cancellationReason && <p className="mt-0.5 text-xs text-muted">{a.cancellationReason}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusBadge kind="appointment" status={a.status} t={t} />
                  <AppointmentActions
                    id={a.id}
                    status={a.status}
                    sessionId={a.sessionId}
                    isMine={a.staffId === actor.staffId}
                    canManage={manageAll}
                    canDocument={can(actor, "clinical.view")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
