"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/client";
import { AXIS_TEXT, GRID, SERIES, SURFACE } from "./palette";

type Row = { day: string; completed: number; missed: number; upcoming: number };

export function WeekChart({ data }: { data: Row[] }) {
  const { t, locale } = useI18n();
  const fmt = new Intl.DateTimeFormat(locale === "te" ? "te-IN" : "en-IN", { weekday: "short", timeZone: "UTC" });
  const rows = data.map((d) => ({ ...d, label: fmt.format(new Date(`${d.day}T12:00:00Z`)) }));
  const keys = [
    { key: "completed", label: t("admin.completed"), color: SERIES.completed },
    { key: "upcoming", label: t("enum.appointmentStatus.scheduled"), color: SERIES.upcoming },
    { key: "missed", label: `${t("admin.noShow")} / ${t("admin.cancelled")}`, color: SERIES.missed },
  ] as const;
  const total = rows.reduce((a, r) => a + r.completed + r.missed + r.upcoming, 0);
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        {keys.map((k) => (
          <li key={k.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: k.color }} aria-hidden />
            {k.label}
          </li>
        ))}
      </ul>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("common.noData")}</p>
      ) : (
        <div className="h-44" role="img" aria-label={t("dashboard.weeklyAttendance")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "rgb(16 32 47 / 0.04)" }}
                contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
                formatter={(value, name) => [value as number, keys.find((k) => k.key === name)?.label ?? String(name)]}
              />
              {keys.map((k, i) => (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  stackId="a"
                  fill={k.color}
                  stroke={SURFACE}
                  strokeWidth={2}
                  maxBarSize={24}
                  radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="sr-only">
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <th>{r.day}</th>
              <td>{r.completed}</td>
              <td>{r.upcoming}</td>
              <td>{r.missed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
