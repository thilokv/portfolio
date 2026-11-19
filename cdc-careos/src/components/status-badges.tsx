import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TranslateFn } from "@/i18n";

const APPT: Record<string, BadgeTone> = {
  scheduled: "blue",
  checked_in: "teal",
  in_progress: "teal",
  completed: "success",
  cancelled: "neutral",
  no_show: "warning",
};
const CHILD: Record<string, BadgeTone> = { active: "success", waitlisted: "blue", on_hold: "warning", discharged: "neutral", archived: "neutral" };
const GOAL: Record<string, BadgeTone> = {
  not_started: "neutral",
  in_progress: "blue",
  achieved: "success",
  partially_achieved: "teal",
  not_achieved: "warning",
  on_hold: "warning",
  discontinued: "neutral",
};
const SESSION: Record<string, BadgeTone> = { in_progress: "blue", completed: "warning", signed: "success" };
const REPORT: Record<string, BadgeTone> = { draft: "neutral", pending_approval: "warning", approved: "blue", shared: "success", withdrawn: "neutral" };
const CONSENT: Record<string, BadgeTone> = { granted: "success", withdrawn: "danger", pending: "warning", refused: "danger" };

const MAPS = { appointment: APPT, child: CHILD, goal: GOAL, session: SESSION, report: REPORT, consent: CONSENT };
const KEYS = {
  appointment: "enum.appointmentStatus",
  child: "enum.childStatus",
  goal: "enum.goalStatus",
  session: "enum.sessionStatus",
  report: "enum.reportStatus",
  consent: "enum.consentStatus",
};

export function StatusBadge({ kind, status, t }: { kind: keyof typeof MAPS; status: string; t: TranslateFn }) {
  return <Badge tone={MAPS[kind][status] ?? "neutral"}>{t(`${KEYS[kind]}.${status}`)}</Badge>;
}
