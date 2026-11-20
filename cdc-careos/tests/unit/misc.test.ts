import { describe, expect, it } from "vitest";
import { redact } from "@/lib/ai-redact";
import { toCsv } from "@/server/services/export";
import { sniffMime, validateUpload } from "@/server/storage";
import { ageFrom, fromLocalDateTime, isoDateIST, istDayBounds, toLocalDateTime } from "@/lib/dates";
import { hashPassword, verifyPassword } from "@/server/auth/crypto";
import { attendanceRate } from "@/server/services/reports-ops";
import { toActionError } from "@/server/errors";

describe("AI de-identification", () => {
  it("removes names, IDs, phones and e-mails", () => {
    const out = redact("Aarav Demo (CDC-0007) mother Padma called from 9876543210, mail padma@example.com, PIN 520001", ["Aarav Demo", "Padma Demo"]);
    expect(out).not.toMatch(/Aarav|Padma|CDC-0007|9876543210|example\.com|520001/);
    expect(out).toContain("[NAME]");
    expect(out).toContain("[PHONE]");
  });
});

describe("CSV export", () => {
  it("escapes quotes and neutralises spreadsheet formulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'He said "hi", ok' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"He said ""hi"", ok"`);
  });
});

describe("upload validation", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffMime(Buffer.from("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffMime(Buffer.from("<html><script>"))).toBeNull();
  });
  it("rejects disguised and oversized files", () => {
    expect(validateUpload(Buffer.from("MZ executable"))).toEqual({ ok: false, error: "validation.fileType" });
    expect(validateUpload(Buffer.alloc(11 * 1024 * 1024, 0x25))).toEqual({ ok: false, error: "validation.fileSize" });
  });
});

describe("dates (IST)", () => {
  it("round-trips local datetime values", () => {
    const d = fromLocalDateTime("2026-03-05T09:30");
    expect(d.toISOString()).toBe("2026-03-05T04:00:00.000Z");
    expect(toLocalDateTime(d)).toBe("2026-03-05T09:30");
    expect(isoDateIST(new Date("2026-03-05T20:00:00Z"))).toBe("2026-03-06");
  });
  it("computes IST day bounds and ages", () => {
    expect(istDayBounds("2026-03-05").start.toISOString()).toBe("2026-03-04T18:30:00.000Z");
    expect(ageFrom("2022-05-20", "2026-05-19")).toEqual({ years: 3, months: 11 });
    expect(ageFrom("2022-05-20", "2026-05-20")).toEqual({ years: 4, months: 0 });
  });
});

describe("passwords", () => {
  it("hashes with salt and verifies", async () => {
    const h1 = await hashPassword("Correct-Horse-2026");
    const h2 = await hashPassword("Correct-Horse-2026");
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("Correct-Horse");
    expect(await verifyPassword("Correct-Horse-2026", h1)).toBe(true);
    expect(await verifyPassword("wrong-password-1", h1)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("reporting & errors", () => {
  it("returns no attendance rate without data", () => {
    expect(attendanceRate({ completed: 0, noShow: 0, cancelledFamily: 0 })).toBeNull();
    expect(attendanceRate({ completed: 3, noShow: 1, cancelledFamily: 0 })).toBe(75);
  });
  it("maps database errors to safe messages", () => {
    expect(toActionError({ code: "23P01", constraint: "appointments_staff_no_overlap" }).error).toBe("errors.staffDoubleBooked");
    expect(toActionError({ code: "23P01", constraint: "appointments_child_no_overlap" }).error).toBe("errors.childDoubleBooked");
    expect(toActionError({ cause: { code: "P0001" } }).error).toBe("errors.recordLocked");
  });
});
