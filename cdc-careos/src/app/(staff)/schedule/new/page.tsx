import { redirect } from "next/navigation";
import { withOrg } from "@/db";
import { can, requireStaffPage, staffCtx } from "@/server/auth/actor";
import { schedulingOptions } from "@/server/services/scheduling";
import { getT } from "@/i18n/server";
import { isoDateIST } from "@/lib/dates";
import { isValidDate } from "@/lib/validation/common";
import { PageHeader } from "@/components/ui/misc";
import { AppointmentForm } from "@/components/schedule/appointment-form";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ date?: string; child?: string }> }) {
  const actor = await requireStaffPage();
  const manageAll = can(actor, "appointments.manage_all");
  if (!manageAll && !can(actor, "appointments.manage_own")) redirect("/forbidden");
  const t = await getT();
  const sp = await searchParams;
  const date = sp.date && isValidDate(sp.date) && sp.date >= isoDateIST() ? sp.date : isoDateIST();
  const opts = await withOrg(staffCtx(actor), (tx) => schedulingOptions(tx, actor));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("schedule.new")} />
      <AppointmentForm
        childrenOptions={opts.children}
        services={opts.services}
        restrictToStaffId={manageAll ? undefined : actor.staffId}
        defaults={{ start: `${date}T10:00`, childId: opts.children.some((c) => c.id === sp.child) ? sp.child : "" }}
      />
    </div>
  );
}
