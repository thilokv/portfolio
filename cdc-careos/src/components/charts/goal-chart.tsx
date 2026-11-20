"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/client";
import { AXIS_TEXT, GRID, PRIMARY_SERIES, SURFACE } from "./palette";

/** Single-series success-rate chart. Only measured observations are plotted. */
export function GoalChart({ points, targetPercent }: { points: { date: string; rate: number; independent: number | null }[]; targetPercent: number | null }) {
  const { t, locale } = useI18n();
  const fmt = new Intl.DateTimeFormat(locale === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const data = points.map((p) => ({ ...p, label: fmt.format(new Date(`${p.date}T12:00:00Z`)) }));
  return (
    <div className="h-48" role="img" aria-label={`${t("progress.successRate")}: ${data.map((d) => `${d.label} ${d.rate}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} unit="%" />
          {targetPercent != null && (
            <ReferenceLine y={targetPercent} stroke={AXIS_TEXT} strokeOpacity={0.6} label={{ value: `${t("progress.targetLine")} ${targetPercent}%`, position: "insideTopRight", fill: AXIS_TEXT, fontSize: 11 }} />
          )}
          <Tooltip
            contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
            formatter={(v, name) => [`${v}%`, name === "rate" ? t("progress.successRate") : t("progress.independentRate")]}
          />
          <Line
            type="linear"
            dataKey="rate"
            stroke={PRIMARY_SERIES}
            strokeWidth={2}
            dot={{ r: 4, fill: PRIMARY_SERIES, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
