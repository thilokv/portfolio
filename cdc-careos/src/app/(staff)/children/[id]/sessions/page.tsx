import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { withOrg } from "@/db";
import { can, staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listSessions } from "@/server/services/scheduling";
import { getLocale, getT } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/misc";
import { SessionList } from "@/components/sessions/session-list";

export default async function ChildSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(staffCtx(actor), (tx) => listSessions(tx, actor, { childId: id }));
  const canSchedule = child.status === "active" && (can(actor, "appointments.manage_all") || can(actor, "appointments.manage_own"));
  return (
    <div>
      <SectionTitle action={canSchedule ? <Button asChild size="sm" variant="secondary"><Link href={`/schedule/new?child=${id}`}><CalendarPlus /> {t("schedule.new")}</Link></Button> : null}>
        {t("sessions.title")}
      </SectionTitle>
      <SessionList rows={rows} t={t} locale={locale} showChild={false} />
    </div>
  );
}
