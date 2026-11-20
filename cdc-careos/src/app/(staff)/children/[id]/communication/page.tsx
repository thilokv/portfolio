import { redirect } from "next/navigation";
import { Lock, MessagesSquare, Send, CheckCheck, Share2, Undo2 } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listMessages, listReports } from "@/server/services/communication";
import { acknowledgeMessageAction, transitionReportAction } from "@/server/actions/communication";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime, formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { NewMessageDialog, ReportDialog } from "@/components/communication/dialogs";

export default async function CommunicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canViewClinical) redirect(`/children/${id}`);
  const [t, locale] = [await getT(), await getLocale()];
  const { messages, reports } = await withOrg(staffCtx(actor), async (tx) => ({
    messages: await listMessages(tx, actor, id),
    reports: await listReports(tx, actor, id),
  }));
  const writable = access.canWriteClinical && child.status !== "archived";
  const canApprove = actor.permissions.includes("reports.approve");
  const isPsych = actor.roles.includes("psychologist");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("communication.title")}</CardTitle>
          {writable && <NewMessageDialog childId={id} />}
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <EmptyState icon={MessagesSquare} title={t("communication.empty")} className="py-6" />
          ) : (
            <ul className="space-y-3">
              {messages.map(({ m, staffName, guardianName }) => (
                <li key={m.id} className={`rounded-xl border p-3 ${m.direction === "from_guardian" ? "border-sky-100 bg-sky-50/50" : "border-line"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.direction === "from_guardian" ? "blue" : "teal"}>{m.direction === "from_guardian" ? t("communication.fromFamily") : t("communication.toFamily")}</Badge>
                      <Badge tone="neutral">{t(`enum.messageKind.${m.kind}`)}</Badge>
                    </div>
                    <span className="text-xs text-muted">{formatDateTime(m.createdAt, locale)}</span>
                  </div>
                  <p className="mt-2 font-medium text-ink">{m.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{m.body}</p>
                  {m.bodyTe && <p lang="te" className="mt-2 whitespace-pre-wrap border-t border-line pt-2 text-sm text-navy-700">{m.bodyTe}</p>}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>{staffName ?? guardianName}</span>
                    {m.direction === "to_guardian" && <span>{m.readAt ? `${t("communication.readByFamily")} · ${formatDateTime(m.readAt, locale)}` : t("communication.unread")}</span>}
                    {m.direction === "from_guardian" && !m.acknowledgedAt && (
                      <ConfirmActionButton label={t("communication.acknowledge")} action={acknowledgeMessageAction.bind(null, m.id)} variant="secondary" icon={<CheckCheck />} />
                    )}
                    {m.direction === "from_guardian" && m.acknowledgedAt && <span>{t("communication.acknowledged")}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("communication.reports")}</CardTitle>
          {writable && (
            <ReportDialog mode="new" canPsych={isPsych} initial={{ childId: id, reportType: "progress_summary", title: "", periodStart: "", periodEnd: "", content: "", contentTe: "", teReviewed: false }} />
          )}
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState title={t("communication.noReports")} className="py-6" />
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3" data-testid="report-item">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="text-xs text-muted">
                        {t(`enum.reportType.${r.reportType}`)} · {r.authorName}
                        {r.periodStart ? ` · ${formatDate(r.periodStart, locale)} – ${formatDate(r.periodEnd, locale)}` : ""}
                        {r.approverName ? ` · ${t("plans.approvedBy", { name: r.approverName })}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.isRestricted && <Badge tone="warning"><Lock className="size-3" /></Badge>}
                      <StatusBadge kind="report" status={r.status} t={t} />
                    </div>
                  </div>
                  {r.hidden ? (
                    <p className="mt-2 text-sm text-muted">{t("common.restrictedHint")}</p>
                  ) : (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-navy-600">{t("common.view")}</summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-navy-700">{r.content}</p>
                      {r.contentTe && <p lang="te" className="mt-2 whitespace-pre-wrap border-t border-line pt-2 text-sm text-navy-700">{r.contentTe}</p>}
                    </details>
                  )}
                  {!r.hidden && writable && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                      {r.isAuthor && ["draft", "pending_approval"].includes(r.status) && (
                        <ReportDialog mode="edit" canPsych={isPsych} initial={{ id: r.id, childId: id, reportType: r.reportType, title: r.title, periodStart: r.periodStart ?? "", periodEnd: r.periodEnd ?? "", content: r.content, contentTe: r.contentTe ?? "", teReviewed: !!r.teTranslationReviewedBy }} />
                      )}
                      {r.isAuthor && r.status === "draft" && (
                        <ConfirmActionButton label={t("communication.submitForApproval")} action={transitionReportAction.bind(null, { reportId: r.id, to: "pending_approval" })} variant="secondary" icon={<Send />} />
                      )}
                      {canApprove && r.status === "pending_approval" && (!r.isAuthor || r.reportType === "psychological_report") && (
                        <ConfirmActionButton label={t("communication.approve")} action={transitionReportAction.bind(null, { reportId: r.id, to: "approved" })} variant="accent" icon={<CheckCheck />} />
                      )}
                      {(canApprove || r.isAuthor) && r.status === "approved" && (
                        <ConfirmActionButton label={t("communication.share")} confirmText={t("portal.privacyNote")} action={transitionReportAction.bind(null, { reportId: r.id, to: "shared" })} variant="primary" icon={<Share2 />} />
                      )}
                      {(canApprove || r.isAuthor) && r.status === "shared" && (
                        <ConfirmActionButton label={t("communication.withdraw")} confirmText={t("communication.withdraw")} action={transitionReportAction.bind(null, { reportId: r.id, to: "withdrawn" })} variant="danger-outline" icon={<Undo2 />} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
