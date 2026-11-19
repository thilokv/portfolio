/**
 * De-identification applied to every AI prompt BEFORE it reaches any provider.
 * Removes known names, child IDs, phone numbers, e-mails, Aadhaar-like numbers
 * and PIN codes. Pure function — unit tested.
 */
export function redact(text: string, knownNames: string[] = []): string {
  // E-mails first, so a name inside an address cannot leave the domain behind.
  let out = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]");
  const names = [...new Set(knownNames.flatMap((n) => [n, ...n.split(/\s+/)]).map((n) => n.trim()).filter((n) => n.length >= 3))].sort(
    (a, b) => b.length - a.length,
  );
  for (const n of names) {
    out = out.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[NAME]");
  }
  out = out
    .replace(/\b[A-Z]{2,6}-\d{3,6}\b/g, "[CHILD_ID]")
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[ID_NUMBER]")
    .replace(/(\+91[\s-]?)?\b[6-9]\d{9}\b/g, "[PHONE]")
    .replace(/\b\d{6}\b/g, "[PIN]");
  return out;
}
