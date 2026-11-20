"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { useT } from "@/i18n/client";
import { generateDraftAction, reviewDraftAction } from "@/server/actions/ai";

const FEATURES = ["activity_suggestions", "session_note_draft", "progress_summary_draft", "parent_message_te", "parent_report_draft", "admin_help"] as const;

export function AiAssistant({ childrenOptions }: { childrenOptions: { id: string; label: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [feature, setFeature] = useState<(typeof FEATURES)[number]>("activity_suggestions");
  const [text, setText] = useState("");
  const [childId, setChildId] = useState("");
  const [result, setResult] = useState<{ id: string; output: string; provider: string; consentUsed: boolean; redactedInput: string } | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const generate = () =>
    start(async () => {
      const res = await generateDraftAction({ feature, text, childId });
      if (!res.ok) return void toast.error(t(res.error));
      setResult(res.data ?? null);
      router.refresh();
    });
  const review = (status: "accepted" | "discarded") =>
    start(async () => {
      if (!result) return;
      const res = await reviewDraftAction({ id: result.id, status });
      if (!res.ok) return void toast.error(t(res.error));
      toast.success(t(res.message ?? "common.saved"));
      if (status === "discarded") setResult(null);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <FormField label={t("ai.feature")} htmlFor="ai-feature">
            <Select id="ai-feature" value={feature} onChange={(e) => setFeature(e.target.value as typeof feature)}>
              {FEATURES.map((f) => <option key={f} value={f}>{t(`ai.features.${f}`)}</option>)}
            </Select>
          </FormField>
          <FormField label={t("ai.childContext")} htmlFor="ai-child">
            <Select id="ai-child" value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">—</option>
              {childrenOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label={t("ai.input")} htmlFor="ai-input" hint={t("ai.inputHint")}>
            <Textarea id="ai-input" rows={7} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
          </FormField>
          <Button variant="accent" onClick={generate} disabled={!text.trim()} loading={pending}>
            <Sparkles /> {pending ? t("ai.generating") : t("ai.generate")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("ai.output")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!result ? (
            <p className="text-sm text-muted">{t("ai.rules")}</p>
          ) : (
            <>
              <Alert tone="warning">{t("ai.reviewBanner")}</Alert>
              {childId && !result.consentUsed && <Alert tone="info">{t("ai.consentMissing")}</Alert>}
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 font-sans text-sm text-ink" data-testid="ai-output">{result.output}</pre>
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">De-identified input sent ({result.provider})</summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans">{result.redactedInput}</pre>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(result.output); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check /> : <Copy />} {copied ? t("ai.copied") : t("ai.copy")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => review("accepted")} loading={pending}><Check /> {t("ai.accept")}</Button>
                <Button size="sm" variant="ghost" onClick={() => review("discarded")}><X /> {t("ai.discard")}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
