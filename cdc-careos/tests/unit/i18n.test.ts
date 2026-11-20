import { describe, expect, it } from "vitest";
import { createTranslator, dictionaries, flattenKeys } from "@/i18n";

describe("English + Telugu translations", () => {
  const enKeys = flattenKeys(dictionaries.en).sort();
  const teKeys = flattenKeys(dictionaries.te).sort();

  it("Telugu covers every English key", () => {
    expect(teKeys).toEqual(enKeys);
  });

  it("has no empty strings", () => {
    const t = createTranslator("te");
    for (const k of teKeys) expect(t(k).trim().length, k).toBeGreaterThan(0);
  });

  it("keeps the same placeholders in both languages", () => {
    const en = createTranslator("en");
    const te = createTranslator("te");
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of enKeys) expect(ph(te(k)), k).toBe(ph(en(k)));
  });

  it("actually contains Telugu script for user-facing navigation", () => {
    const te = createTranslator("te");
    for (const k of ["nav.dashboard", "nav.children", "common.save", "validation.required", "portal.reports"]) {
      expect(te(k)).toMatch(/[ఀ-౿]/);
    }
  });

  it("interpolates variables and falls back to the key for unknown entries", () => {
    const te = createTranslator("te");
    expect(te("children.created", { code: "CDC-0001" })).toContain("CDC-0001");
    expect(te("does.not.exist")).toBe("does.not.exist");
  });
});
