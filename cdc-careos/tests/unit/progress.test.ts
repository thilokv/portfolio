import { describe, expect, it } from "vitest";
import { chartPoints, describeTrend, independentRate, successRate } from "@/lib/progress";

const o = (observedOn: string, trialsTotal: number | null, trialsSuccessful: number | null, independentTrials: number | null = null) => ({
  observedOn,
  trialsTotal,
  trialsSuccessful,
  independentTrials,
});

describe("progress calculations", () => {
  it("never treats missing trial data as zero", () => {
    expect(successRate(o("2026-01-01", null, null))).toBeNull();
    expect(successRate(o("2026-01-01", 10, 0))).toBe(0);
    expect(successRate(o("2026-01-01", 10, 7))).toBe(70);
  });
  it("computes independent rate only when recorded", () => {
    expect(independentRate(o("2026-01-01", 10, 6, null))).toBeNull();
    expect(independentRate(o("2026-01-01", 10, 6, 3))).toBe(30);
  });
  it("excludes unmeasured observations from charts (gaps are not filled)", () => {
    const pts = chartPoints([o("2026-01-03", 10, 5), o("2026-01-01", 10, 2), o("2026-01-02", null, null)]);
    expect(pts.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-03"]);
  });
  it("requires at least 3 measured observations before describing a trend", () => {
    expect(describeTrend([o("2026-01-01", 10, 2), o("2026-01-02", 10, 9)])).toBe("insufficient");
    expect(describeTrend([o("2026-01-01", 10, 2), o("2026-01-02", null, null), o("2026-01-03", 10, 9)])).toBe("insufficient");
  });
  it("describes trends conservatively", () => {
    expect(describeTrend([o("1", 10, 2), o("2", 10, 3), o("3", 10, 6), o("4", 10, 7)])).toBe("up");
    expect(describeTrend([o("1", 10, 8), o("2", 10, 7), o("3", 10, 3), o("4", 10, 2)])).toBe("down");
    expect(describeTrend([o("1", 10, 5), o("2", 10, 6), o("3", 10, 5), o("4", 10, 6)])).toBe("flat");
  });
});
