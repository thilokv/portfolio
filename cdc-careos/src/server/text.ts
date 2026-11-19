/** Small text helpers shared by services (no framework imports). */
export function nn(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const v = value.trim();
  return v === "" ? null : v;
}
export function intOrNull(value: string | null | undefined): number | null {
  const v = nn(value);
  return v === null ? null : Number.parseInt(v, 10);
}
