interface SparklineProps {
  values: number[];
  label: string;
}

/** Tiny trend line from stored daily closes. Needs at least two points. */
export function Sparkline({ values, label }: SparklineProps) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="h-9 w-28 shrink-0 overflow-visible">
      <polygon points={area} fill="var(--brand)" fillOpacity="0.12" />
      <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="3" fill="var(--brand)" />
    </svg>
  );
}
