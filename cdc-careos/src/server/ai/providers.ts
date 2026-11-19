/**
 * AI provider abstraction. The default "mock" provider is offline and free.
 * The "anthropic" provider is only used when AI_PROVIDER=anthropic AND
 * ANTHROPIC_API_KEY is set (requires the center's approval, consent and a
 * privacy review — see docs/AI_GOVERNANCE.md).
 */
import "server-only";

export const AI_FEATURES = [
  "activity_suggestions",
  "session_note_draft",
  "progress_summary_draft",
  "parent_message_te",
  "parent_report_draft",
  "admin_help",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export interface AiRequest {
  feature: AiFeature;
  /** Already de-identified text. */
  input: string;
  /** Already de-identified context (age band, goal titles). */
  context?: string;
}

export interface AiProvider {
  name: string;
  generate(req: AiRequest): Promise<string>;
}

export const SYSTEM_RULES = `You are a drafting assistant for professionals at a child development center in Andhra Pradesh, India.
Strict rules:
- Never diagnose (e.g. autism, ADHD, intellectual disability) or suggest a diagnosis.
- Never prescribe treatment, therapy intensity, medication or dosage.
- Never invent observations, measurements, scores or findings. Use only facts present in the input.
- Clearly separate "Observed (from the professional's notes)" from "Suggestions for the professional to consider".
- Write plainly; mark anything uncertain as "[to confirm]".
- Output is a DRAFT for a qualified professional to review, edit and approve.`;

const FEATURE_PROMPTS: Record<AiFeature, string> = {
  activity_suggestions: "Suggest 3-5 simple, play-based, low-cost home or session activity ideas related to the goal area described. Do not prescribe frequency or intensity.",
  session_note_draft: "Reorganise the professional's rough notes into a session-note draft with sections: Activities, Child response, Observed (facts only), Follow-up items [to confirm]. Do not add facts.",
  progress_summary_draft: "Draft a neutral progress summary using ONLY the data provided. If data is insufficient for a statement, say so.",
  parent_message_te: "Translate the parent message into simple, natural Telugu used by families in Andhra Pradesh. Keep professional terms in English in brackets. Do not add content.",
  parent_report_draft: "Rewrite the provided professional text in warm, plain language for parents. Keep every fact, add none, avoid jargon.",
  admin_help: "Help with the administrative task described (e.g. scheduling message, reminder, checklist). No clinical content.",
};

export function buildPrompt(req: AiRequest): string {
  return `${FEATURE_PROMPTS[req.feature]}\n\n${req.context ? `Context (de-identified):\n${req.context}\n\n` : ""}Input:\n${req.input}`;
}

/** Deterministic offline provider — restructures input, never invents facts. */
export const mockProvider: AiProvider = {
  name: "mock",
  async generate(req) {
    const lines = req.input.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const bullets = lines.map((l) => `- ${l}`).join("\n") || "- [no notes provided]";
    switch (req.feature) {
      case "activity_suggestions":
        return [
          "[MOCK DRAFT — generic ideas, not a prescription]",
          "Suggestions for the professional to consider (adapt to the child and family):",
          "- Turn-taking play with a favourite toy, pausing to give the child a chance to respond.",
          "- Everyday routines (meals, dressing, bath) used as short practice moments.",
          "- Picture cards or real objects to offer simple choices.",
          "- Songs or rhymes with actions, repeated in the same order each day.",
          "Request considered:",
          bullets,
        ].join("\n");
      case "session_note_draft":
        return ["[MOCK DRAFT — review before saving]", "Observed (from the professional's notes):", bullets, "", "Child response: [to confirm]", "Follow-up items: [to confirm]"].join("\n");
      case "progress_summary_draft":
        return ["[MOCK DRAFT — based only on the data below]", "Recorded information:", bullets, "", "Interpretation: [professional to complete — do not state improvement unless supported by recorded observations]"].join("\n");
      case "parent_message_te":
        return [
          "[MOCK — the offline provider cannot translate. Please write or review the Telugu text yourself.]",
          "ఇంగ్లీష్ సందేశం (అనువాదం కోసం):",
          bullets,
        ].join("\n");
      case "parent_report_draft":
        return ["[MOCK DRAFT — parent-friendly wording to be written by the professional]", "Points to explain to the family (from your text):", bullets].join("\n");
      case "admin_help":
        return ["[MOCK DRAFT]", "Checklist based on your request:", bullets, "- Confirm dates/times with the family.", "- Record the outcome in CareOS."].join("\n");
    }
  },
};

export function getProvider(): AiProvider {
  if (process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return anthropicProvider;
  }
  return mockProvider;
}

const anthropicProvider: AiProvider = {
  name: "anthropic",
  async generate(req) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: process.env.AI_MODEL || "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM_RULES,
      messages: [{ role: "user", content: buildPrompt(req) }],
    });
    const msg = response;
    if (msg.stop_reason === "refusal") return "[The AI provider declined this request. Please write this draft manually.]";
    return msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  },
};
