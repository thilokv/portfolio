import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Lock, Plus } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listAssessments } from "@/server/services/assessments";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/misc";

export default async function AssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const rows = await withOrg(staffCtx(actor), (tx) => listAssessments(tx, actor, id));
  const canCreate = access.canWriteClinical && child.status !== "archived";
  return (
    <div>
      <SectionTitle action={canCreate ? <Button asChild size="sm" variant="accent"><Link href={`/children/${id}/assessments/new`}><Plus /> {t("assessments.new")}</Link></Button> : null}>
        {t("assessments.title")}
      </SectionTitle>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t("assessments.empty")} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id}>
                {a.hidden ? (
                  <div className="flex items-center gap-3 px-5 py-3.5 text-sm text-muted">
                    <Lock className="size-4" aria-hidden /> {t("common.restricted")} · {formatDate(a.assessmentDate, locale)} · {a.assessorName}
                  </div>
                ) : (
                  <Link href={`/children/${id}/assessments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-navy-50/60">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{a.toolName}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(a.assessmentDate, locale)} · {a.assessorName} ({t(`enum.role.${a.assessorRole}`)}){a.serviceCode ? ` · ${t(`enum.service.${a.serviceCode}`)}` : ""}
                      </span>
                    </span>
                    <span className="flex gap-1.5">
                      {a.isRestricted && <Badge tone="warning"><Lock className="size-3" /> {t("assessments.restrictedLabel")}</Badge>}
                      <Badge tone={a.status === "finalized" ? "success" : "neutral"}>{t(`enum.recordStatus.${a.status}`)}</Badge>
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
