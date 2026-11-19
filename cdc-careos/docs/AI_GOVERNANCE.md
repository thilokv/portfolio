# AI Governance

## Current state
- `AI_PROVIDER=mock` (default): a deterministic, offline provider. No data leaves the server, no cost. It only restructures text the professional typed and labels everything as a draft. It cannot translate.
- An optional external provider (Anthropic Claude via the official SDK, model `claude-opus-5-5` by default, configurable with `AI_MODEL`) is implemented but **inactive** until `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set. This is a **paid** service; do not enable it without approval.

## Safeguards implemented
1. **System rules** sent with every request: never diagnose, never prescribe treatment, never invent findings, separate observed facts from suggestions, mark uncertainty.
2. **De-identification** (`src/lib/ai-redact.ts`) before any provider call: child/guardian/staff names, child IDs, e-mails, phone numbers, Aadhaar-like numbers and PIN codes are replaced with placeholders. The exact redacted text is shown to the user and stored.
3. **Consent gate**: a child's age and goal titles are added as context only when "AI-assisted drafting" consent is recorded as granted.
4. **Human review**: outputs are stored in `ai_drafts` with status `pending_review`; the professional marks them reviewed or discards them. AI never writes to clinical records — staff copy reviewed text manually.
5. **Audit & rate limits**: every generation is audited; 30 requests per 10 minutes per user.
6. Refusals from the provider are shown as "write this draft manually"; server-side model fallback is enabled for reliability.

## Before enabling an external provider (decision for management)
- Approve the cost (pay-per-use) and set a monthly budget/alert in the provider console.
- Review the provider's data-processing terms, retention, and region against DPDP Act obligations; prefer zero-retention options if available to your account.
- Update the parent consent form to describe AI-assisted drafting with de-identified text, and record consent per child.
- Train staff: no identifiers in prompts, every output must be verified, AI text is never final.
- Then set in the server's secret store: `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<key>` (never in code or chat).

## Telugu translation
Machine translation of clinical content must be reviewed by a fluent professional. Diagnoses and assessment conclusions must not be translated without professional review. The app enforces a review checkbox before Telugu text reaches families.
