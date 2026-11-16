"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { KARATS } from "@/lib/types";
import { availableKarats, buildChanges, buildSeries, RANGES, type Range, type SeriesRow } from "@/lib/chart";
import { formatPct, formatRupees, formatSigned } from "@/lib/format";
import { formatShortDate } from "@/lib/time";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { DailyClose, Karat } from "@/lib/types";

const STYLE: Record<Karat, { color: string; dash?: string }> = {
  "24K": { color: "var(--c24)" },
  "22K": { color: "var(--c22)", dash: "7 4" },
  "18K": { color: "var(--c18)", dash: "2 4" },
};
function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(window.location.search).get(key);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** Keep the chart settings in the URL so a reload or a shared link shows the same view. */
function writeParam(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

const AXIS = { fontSize: 12, fill: "var(--muted)" } as const;
const compact = (n: number) => `₹${(n / 1000).toFixed(1)}k`;

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`min-h-9 min-w-11 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors ${
            o === value ? "bg-action text-on-action shadow-sm" : "text-muted hover:bg-brand-soft hover:text-brand-strong"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

interface TipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string }[];
  mode: "price" | "change";
}

function ChartTip({ active, label, payload, mode }: TipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2 text-sm shadow-card">
      <p className="mb-1 font-semibold">{formatShortDate(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="num flex items-center justify-between gap-4">
          <span className="text-muted">{p.dataKey === "change" ? "Change" : p.dataKey}</span>
          <span className="font-medium">{mode === "price" ? formatRupees(p.value) : formatSigned(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function periodStats(series: SeriesRow[], karat: Karat) {
  const pts = series.filter((r) => r[karat] !== undefined).map((r) => ({ d: r.date, v: r[karat] as number }));
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts.at(-1)!;
  return {
    change: last.v - first.v,
    pct: ((last.v - first.v) / first.v) * 100,
    high: Math.max(...pts.map((p) => p.v)),
    low: Math.min(...pts.map((p) => p.v)),
    from: first.d,
    to: last.d,
    first: first.v,
    last: last.v,
  };
}

export default function HistoryChart({ closes }: { closes: DailyClose[] }) {
  const karats = useMemo(() => availableKarats(closes), [closes]);
  // This component only renders in the browser (ssr: false), so reading the URL here cannot mismatch.
  const [range, setRangeState] = useState<Range>(() => readParam("range", RANGES, "30D"));
  const [hidden, setHidden] = useState<Karat[]>([]);
  const [barKarat, setBarKaratState] = useState<Karat>(() => readParam("karat", KARATS, "24K"));
  const setRange = (r: Range) => {
    setRangeState(r);
    writeParam("range", r);
  };
  const setBarKarat = (k: Karat) => {
    setBarKaratState(k);
    writeParam("karat", k);
  };
  const animate = !useReducedMotion();

  const series = useMemo(() => buildSeries(closes, range), [closes, range]);
  const changes = useMemo(() => buildChanges(series, barKarat), [series, barKarat]);
  const stats = periodStats(series, "24K");
  const shown = karats.filter((k) => !hidden.includes(k));
  // A karat with a single stored day can't form a line and would stretch the Y axis.
  const plotted = shown.filter((k) => series.filter((r) => r[k] !== undefined).length >= 2);
  const pending = shown.filter((k) => !plotted.includes(k));

  const toggle = (k: Karat) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show karats">
          {karats.map((k) => {
            const on = !hidden.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(k)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors ${
                  on ? "border-brand/40 bg-brand-soft text-ink" : "border-line text-muted hover:bg-surface"
                }`}
              >
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="1" y1="4" x2="21" y2="4" stroke={STYLE[k].color} strokeWidth="2.5" strokeDasharray={STYLE[k].dash} strokeLinecap="round" opacity={on ? 1 : 0.35} />
                </svg>
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {stats ? (
        <p className="sr-only">
          24K moved from {formatRupees(stats.first)} on {stats.from} to {formatRupees(stats.last)} on {stats.to}, a change of {formatSigned(stats.change)} ({formatPct(stats.pct)}). High {formatRupees(stats.high)}, low {formatRupees(stats.low)}. The table below lists every day.
        </p>
      ) : null}

      {stats ? (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ["24K change", `${formatSigned(stats.change)} (${formatPct(stats.pct)})`],
            ["Period high", formatRupees(stats.high)],
            ["Period low", formatRupees(stats.low)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-bg p-3 sm:p-4">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="num mt-1 text-sm font-semibold sm:text-lg">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <figure className="rounded-2xl border border-line bg-bg p-3 shadow-card sm:p-5">
        <figcaption className="mb-3 text-sm font-semibold">Price per gram</figcaption>
        {series.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted">Not enough days stored in this range to draw a line yet.</p>
        ) : plotted.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Select at least one karat with two or more stored days.</p>
        ) : (
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={24} />
                <YAxis tickFormatter={compact} tick={AXIS} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTip mode="price" />} cursor={{ stroke: "var(--brand)", strokeOpacity: 0.3 }} />
                {plotted.map((k) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={STYLE[k].color} strokeWidth={2.5} strokeDasharray={STYLE[k].dash} dot={{ r: 3, strokeWidth: 0, fill: STYLE[k].color }} activeDot={{ r: 5 }} connectNulls isAnimationActive={animate} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {pending.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            {pending.join(", ")} will appear as a line once a second day is stored.
          </p>
        ) : null}
      </figure>

      <figure className="rounded-2xl border border-line bg-bg p-3 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <figcaption className="text-sm font-semibold">Day-over-day change per gram</figcaption>
          <Segmented label="Karat for change bars" options={karats} value={barKarat} onChange={setBarKarat} />
        </div>
        {changes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Needs at least two stored days for {barKarat}. History for 18K builds up from the first saved day.</p>
        ) : (
          <div className="h-44 w-full sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={changes} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatSigned(v)} />
                <Tooltip content={<ChartTip mode="change" />} cursor={{ fill: "var(--brand-soft)", fillOpacity: 0.5 }} />
                <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.6} />
                <Bar dataKey="change" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={animate}>
                  {changes.map((c) => (
                    <Cell key={c.date} fill={c.change >= 0 ? "var(--up)" : "var(--down)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Bars above the zero line are rises, below are falls.</p>
      </figure>

    </div>
  );
}
