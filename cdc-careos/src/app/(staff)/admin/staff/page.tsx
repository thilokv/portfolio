import type { Metadata } from "next";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listStaff } from "@/server/services/admin";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { AvailabilityDialog, StaffFormDialog, StaffRowActions } from "@/components/admin/staff-components";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffAdminPage() {
  const actor = await requireStaffPage("staff.manage");
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(staffCtx(actor), (tx) => listStaff(tx, actor));
  return (
    <>
      <PageHeader title={t("admin.staffTitle")} description={t("admin.staffSubtitle")} actions={<StaffFormDialog />} />
      <Card>
        <ul className="divide-y divide-line" data-testid="staff-list">
          {rows.map((s) => (
            <li key={s.id} className={`px-4 py-4 sm:px-5 ${s.isActive ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={s.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{s.fullName}</p>
                    <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? t("admin.active") : t("admin.inactive")}</Badge>
                    {s.locked && <Badge tone="danger">Locked</Badge>}
                  </div>
                  <p className="text-xs text-muted">{s.email}{s.designation ? ` · ${s.designation}` : ""}{s.registrationNumber ? ` · ${s.registrationNumber}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.roles.map((r) => <Badge key={r} tone="teal">{t(`enum.role.${r}`)}</Badge>)}
                    {s.availability.map((a) => <Badge key={a.id} tone="warning">{a.date}: {t(`enum.availability.${a.status}`)}</Badge>)}
                  </div>
                  <p className="mt-1 text-xs text-muted">Last sign-in: {s.lastLoginAt ? formatDateTime(s.lastLoginAt, locale) : "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <StaffFormDialog
                    initial={{ id: s.id, fullName: s.fullName, email: s.email, phone: s.phone ?? "", designation: s.designation ?? "", qualifications: s.qualifications ?? "", registrationNumber: s.registrationNumber ?? "", roles: s.roles }}
                  />
                  <AvailabilityDialog staffId={s.id} entries={s.availability.map((a) => ({ id: a.id, date: a.date, status: a.status, note: a.note }))} />
                  <StaffRowActions staffId={s.id} active={s.isActive} isSelf={s.id === actor.staffId} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
