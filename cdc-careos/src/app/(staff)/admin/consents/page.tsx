import type { Metadata } from "next";
import Link from "next/link";
import { desc, ne } from "drizzle-orm";
import { withOrg } from "@/db";
import { children, consents } from "@/db/schema";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { getT } from "@/i18n/server";
import { CONSENT_TYPES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Consents" };
const TONE = { granted: "success", withdrawn: "danger", pending: "warning", refused: "danger" } as const;

export default async function ConsentsPage() {
  const actor = await requireStaffPage("consent.manage");
  const t = await getT();
  const { kids, rows } = await withOrg(staffCtx(actor), async (tx) => ({
    kids: await tx.select({ id: children.id, fullName: children.fullName, childCode: children.childCode }).from(children).where(ne(children.status, "archived")).orderBy(children.fullName),
    rows: await tx.select({ childId: consents.childId, type: consents.consentType, status: consents.status }).from(consents).orderBy(desc(consents.createdAt)),
  }));
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(`${r.childId}:${r.type}`)) latest.set(`${r.childId}:${r.type}`, r.status);
  return (
    <>
      <PageHeader title={t("admin.consentsTitle")} description={t("admin.consentsSubtitle")} />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("schedule.child")}</Th>
              {CONSENT_TYPES.map((c) => <Th key={c} className="min-w-28 whitespace-normal">{t(`enum.consentType.${c}`)}</Th>)}
            </tr>
          </thead>
          <tbody>
            {kids.map((k) => (
              <tr key={k.id}>
                <Td className="whitespace-nowrap"><Link className="font-medium hover:text-teal-700" href={`/children/${k.id}`}>{k.fullName}</Link><div className="text-xs text-muted">{k.childCode}</div></Td>
                {CONSENT_TYPES.map((c) => {
                  const s = latest.get(`${k.id}:${c}`);
                  return <Td key={c}>{s ? <Badge tone={TONE[s as keyof typeof TONE]}>{t(`enum.consentStatus.${s}`)}</Badge> : <span className="text-xs text-muted">{t("admin.missingConsent")}</span>}</Td>;
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
