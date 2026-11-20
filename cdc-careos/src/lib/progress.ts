/**
 * Transparent progress calculations. Pure functions — unit tested.
 *
 * - A success rate exists ONLY for observations where trials were recorded.
 * - Observations without trial data are kept (for the log) but never plotted
 *   or counted as 0%.
 * - A trend statement needs >= 3 measured observations and compares the mean
 *   of the earlier half with the later half; differences under 10 percentage
 *   points are described as "broadly similar".
 */
export interface ObservationLike {
  observedOn: string;
  trialsTotal: number | null;
  trialsSuccessful: number | null;
  independentTrials: number | null;
}

export function successRate(o: ObservationLike): number | null {
  if (o.trialsTotal == null || o.trialsSuccessful == null || o.trialsTotal <= 0) return null;
  return Math.round((o.trialsSuccessful / o.trialsTotal) * 100);
}

export function independentRate(o: ObservationLike): number | null {
  if (o.trialsTotal == null || o.independentTrials == null || o.trialsTotal <= 0) return null;
  return Math.round((o.independentTrials / o.trialsTotal) * 100);
}

export type Trend = "insufficient" | "up" | "down" | "flat";
export const MIN_POINTS_FOR_TREND = 3;
export const TREND_THRESHOLD = 10;

export function describeTrend(observations: ObservationLike[]): Trend {
  const rates = [...observations]
    .sort((a, b) => a.observedOn.localeCompare(b.observedOn))
    .map(successRate)
    .filter((r): r is number => r !== null);
  if (rates.length < MIN_POINTS_FOR_TREND) return "insufficient";
  const half = Math.floor(rates.length / 2);
  const early = rates.slice(0, half);
  const late = rates.slice(rates.length - half);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = mean(late) - mean(early);
  if (delta >= TREND_THRESHOLD) return "up";
  if (delta <= -TREND_THRESHOLD) return "down";
  return "flat";
}

export function chartPoints(observations: ObservationLike[]) {
  return [...observations]
    .sort((a, b) => a.observedOn.localeCompare(b.observedOn))
    .map((o) => ({ date: o.observedOn, rate: successRate(o), independent: independentRate(o) }))
    .filter((p) => p.rate !== null) as { date: string; rate: number; independent: number | null }[];
}
