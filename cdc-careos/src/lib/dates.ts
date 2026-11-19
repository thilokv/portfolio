/**
 * Date helpers. The center operates in India Standard Time (UTC+05:30, no
 * daylight saving), so local wall-clock values are converted with a fixed
 * offset. Dates without time (DOB, review dates) are plain YYYY-MM-DD strings.
 */
export const TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET = "+05:30";

/** YYYY-MM-DD for "now" (or a given instant) in IST. */
export function isoDateIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "YYYY-MM-DDTHH:mm" (datetime-local value, IST) → Date. */
export function fromLocalDateTime(value: string): Date {
  return new Date(`${value}:00${IST_OFFSET}`);
}

/** Date → "YYYY-MM-DDTHH:mm" in IST (for datetime-local inputs). */
export function toLocalDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** UTC instants bounding an IST calendar day. */
export function istDayBounds(isoDate: string): { start: Date; end: Date } {
  const start = new Date(`${isoDate}T00:00:00${IST_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing isoDate. */
export function startOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -dow);
}

export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}
export function endOfMonth(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${isoDate.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Age in completed years and months at a reference date. */
export function ageFrom(dob: string, at: string = isoDateIST()): { years: number; months: number } {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  let months = (ay - by) * 12 + (am - bm);
  if (ad < bd) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

export function formatAge(dob: string, t: (k: string, v?: Record<string, string | number>) => string, at?: string) {
  const { years, months } = ageFrom(dob, at);
  return years > 0 ? `${t("common.years", { n: years })} ${t("common.months", { n: months })}` : t("common.months", { n: months });
}

const intlLocale = (locale: string) => (locale === "te" ? "te-IN" : "en-IN");

export function formatDate(value: string | Date | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00${IST_OFFSET}` : value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatTime(value: Date | string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  return `${formatDate(value instanceof Date ? value : new Date(value), locale)}, ${formatTime(value, locale)}`;
}

export function formatWeekday(isoDate: string, locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${isoDate}T12:00:00${IST_OFFSET}`),
  );
}
