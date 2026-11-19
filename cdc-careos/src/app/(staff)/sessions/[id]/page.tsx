import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "@/server/auth/actor";
import { getSession } from "@/server/services/scheduling";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getLocale, getT } from "@/i18n/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { WORKFLOW_FIELDS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Field, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";
import { AddObservation, SessionNoteForm } from "@/components/sessions/session-note-form";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaffPage("clinical.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = [await getT(), await getLocale()];
  let s;
  try {
    s = await withOrg(staffCtx(actor), (tx) => getSession(tx, actor, id));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) return <Alert tone="danger" title={t("common.restricted")}>{t("common.restrictedHint")}</Alert>;
    throw e;
  }
  const wf = (s.workflowData ?? {}) as Record<string, string>;
  const obsByGoal = new Map(s.observations.map((o) => [o.goalId, o]));
  const addressedIds = new Set(s.addressed.map((a) => a.goalId));

  return (
    <>
      <PageHeader
        eyebrow={`${t(`enum.service.${s.serviceCode}`)} · ${formatDate(s.sessionDate, locale)}`}
        title={<Link href={`/children/${s.childId}/sessions`} className="hover:text-teal-700">{s.childName}</Link>}
        description={`${s.childCode} · ${s.therapistName}`}
        actions={<StatusBadge kind="session" status={s.status} t={t} />}
      />
      {s.status === "signed" && (
        <Alert tone="success" className="mb-4" title={t("sessions.lockedNotice", { date: formatDateTime(s.signedAt, locale) })} />
      )}
      {!s.canEdit && s.status !== "signed" && <Alert tone="info" className="mb-4">{t("sessions.readOnlyNotice", { name: s.therapistName })}</Alert>}

      {s.canEdit ? (
        <SessionNoteForm
          serviceCode={s.serviceCode}
          status={s.status}
          goals={s.goals}
          initial={{
            sessionId: s.id,
            attendance: s.attendance,
            activitiesCompleted: s.activitiesCompleted ?? "",
            childResponse: s.childResponse ?? "",
            overallAssistance: s.overallAssistance ?? "",
            followUp: s.followUp ?? "",
            parentParticipation: s.parentParticipation ?? "",
            homeActivitySuggestion: s.homeActivitySuggestion ?? "",
            workflow: Object.fromEntries(WORKFLOW_FIELDS[s.serviceCode].map((f) => [f.key, wf[f.key] ?? ""])),
            goals: s.goals.map((g) => {
              const o = obsByGoal.get(g.id);
              return {
                goalId: g.id,
                addressed: addressedIds.has(g.id),
                note: o?.note ?? s.addressed.find((a) => a.goalId === g.id)?.note ?? "",
                trialsTotal: o?.trialsTotal?.toString() ?? "",
                trialsSuccessful: o?.trialsSuccessful?.toString() ?? "",
                independentTrials: o?.independentTrials?.toString() ?? "",
                assistanceLevel: o?.assistanceLevel ?? "",
              };
            }),
          }}
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("sessions.noteTitle")}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label={t("sessions.attendance")}>{t(`enum.attendance.${s.attendance}`)}</Field>
                <Field label={t("sessions.overallAssistance")}>{s.overallAssistance ? t(`enum.assistance.${s.overallAssistance}`) : t("common.notRecorded")}</Field>
                <Field label={t("sessions.activities")} className="sm:col-span-2">{s.activitiesCompleted ?? "—"}</Field>
                <Field label={t("sessions.childResponse")} className="sm:col-span-2">{s.childResponse ?? "—"}</Field>
                {WORKFLOW_FIELDS[s.serviceCode].filter((f) => wf[f.key]).map((f) => (
                  <Field key={f.key} label={t(f.label)} className="sm:col-span-2">{wf[f.key]}</Field>
                ))}
                <Field label={t("sessions.followUp")} className="sm:col-span-2">{s.followUp ?? "—"}</Field>
                <Field label={t("sessions.parentParticipation")}>{s.parentParticipation ?? "—"}</Field>
                <Field label={t("sessions.homeActivity")}>{s.homeActivitySuggestion ?? "—"}</Field>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("sessions.goalsAddressed")}</CardTitle></CardHeader>
            <CardContent>
              {s.addressed.length === 0 ? <p className="text-sm text-muted">{t("common.noData")}</p> : (
                <ul className="space-y-3">
                  {s.goals.filter((g) => addressedIds.has(g.id)).map((g) => {
                    const o = obsByGoal.get(g.id);
                    return (
                      <li key={g.id} className="rounded-xl border border-line p-3">
                        <p className="font-medium text-ink">{g.title}</p>
                        <p className="mt-1 text-sm text-muted">
                          {o?.trialsTotal != null ? `${o.trialsSuccessful}/${o.trialsTotal}` : t("common.notRecorded")}
                          {o?.assistanceLevel ? ` · ${t(`enum.assistance.${o.assistanceLevel}`)}` : ""}
                        </p>
                        {o?.note && <p className="mt-1 text-sm text-ink">{o.note}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader><CardTitle>{t("sessions.observations")}</CardTitle></CardHeader>
        <CardContent>
          {s.notes.length === 0 ? <p className="text-sm text-muted">{t("common.noData")}</p> : (
            <ul className="space-y-2">
              {s.notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className="mr-2 rounded-md bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-600">{n.category}</span>
                  {n.observation}
                  <span className="ml-2 text-xs text-muted">— {n.by}, {formatDateTime(n.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
          {s.canEdit ? <AddObservation sessionId={s.id} /> : s.status === "signed" ? <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3" /> {t("errors.recordLocked")}</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
