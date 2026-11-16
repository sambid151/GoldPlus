"use client";

import { useId, useMemo, useState } from "react";
import { calculate, GST_RATE } from "@/lib/calculator";
import { formatRupees, formatRupees2 } from "@/lib/format";
import type { Karat } from "@/lib/types";

interface Props {
  rates: Partial<Record<Karat, number>>;
}

const WEIGHT_PRESETS = [1, 5, 8, 10, 20];
const MAX_WEIGHT = 10_000;
const MAX_MAKING = 50;

function parse(raw: string): number {
  return raw.trim() === "" ? NaN : Number(raw);
}

export function Calculator({ rates }: Props) {
  const karats = (Object.keys(rates) as Karat[]).filter((k) => rates[k]);
  const [karat, setKarat] = useState<Karat>(karats[0] ?? "24K");
  const [weightRaw, setWeightRaw] = useState("10");
  const [makingRaw, setMakingRaw] = useState("8");
  const ids = { weight: useId(), making: useId(), wErr: useId(), mErr: useId() };

  const weight = parse(weightRaw);
  const making = parse(makingRaw);
  const weightError = !(weight > 0) ? "Enter a weight above 0 g." : weight > MAX_WEIGHT ? `Maximum is ${MAX_WEIGHT} g.` : null;
  const makingError = !(making >= 0) ? "Enter 0 or more." : making > MAX_MAKING ? `Maximum is ${MAX_MAKING}%.` : null;

  const result = useMemo(
    () =>
      weightError || makingError || !rates[karat]
        ? null
        : calculate({ weightGrams: weight, ratePerGram: rates[karat]!, makingChargePct: making }),
    [weight, making, karat, rates, weightError, makingError],
  );

  const parts = result
    ? [
        { key: "Gold value", value: result.goldValue, bar: "bg-brand-strong" },
        { key: "Making charge", value: result.makingCharge, bar: "bg-brand" },
        { key: `GST ${GST_RATE * 100}%`, value: result.gst, bar: "bg-brand/40" },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={(e) => e.preventDefault()} className="rounded-2xl border border-line bg-bg p-5 shadow-card sm:p-6" noValidate>
        <fieldset>
          <legend className="text-sm font-semibold">Karat</legend>
          <div role="group" aria-label="Karat" className="mt-2 inline-flex rounded-xl border border-line bg-surface p-1">
            {karats.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === karat}
                onClick={() => setKarat(k)}
                className={`min-h-10 min-w-16 cursor-pointer rounded-lg px-4 text-sm font-medium transition-colors ${
                  k === karat ? "bg-action text-on-action shadow-sm" : "text-muted hover:bg-brand-soft hover:text-brand-strong"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted num">Rate used: {formatRupees(rates[karat] ?? 0)} per gram</p>
        </fieldset>

        <div className="mt-6">
          <label htmlFor={ids.weight} className="text-sm font-semibold">Weight (grams)</label>
          <input
            id={ids.weight}
            name="weight"
            autoComplete="off"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={weightRaw}
            onChange={(e) => setWeightRaw(e.target.value)}
            aria-invalid={weightError ? true : undefined}
            aria-describedby={weightError ? ids.wErr : undefined}
            className="num mt-2 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base focus:border-brand"
          />
          {weightError ? <p id={ids.wErr} role="alert" className="mt-1 text-sm text-down">{weightError}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {WEIGHT_PRESETS.map((g) => (
              <button key={g} type="button" onClick={() => setWeightRaw(String(g))} className="min-h-9 cursor-pointer rounded-full border border-line px-3 text-sm text-muted transition-colors hover:bg-brand-soft hover:text-brand-strong">
                {g} g
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor={ids.making} className="text-sm font-semibold">Making charge (%)</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              aria-label="Making charge slider"
              type="range"
              min="0"
              max={MAX_MAKING}
              step="0.5"
              value={Number.isFinite(making) ? Math.min(making, MAX_MAKING) : 0}
              onChange={(e) => setMakingRaw(e.target.value)}
              className="h-2 w-full cursor-pointer accent-[var(--brand)]"
            />
            <input
              id={ids.making}
              name="making"
              autoComplete="off"
              inputMode="decimal"
              type="number"
              min="0"
              max={MAX_MAKING}
              step="0.5"
              value={makingRaw}
              onChange={(e) => setMakingRaw(e.target.value)}
              aria-invalid={makingError ? true : undefined}
              aria-describedby={makingError ? ids.mErr : undefined}
              className="num block min-h-11 w-24 shrink-0 rounded-xl border border-line bg-bg px-3 text-base focus:border-brand"
            />
          </div>
          {makingError ? <p id={ids.mErr} role="alert" className="mt-1 text-sm text-down">{makingError}</p> : null}
        </div>
      </form>

      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-live="polite">
        <h3 className="text-sm font-semibold">Estimate</h3>
        {result ? (
          <div className="mt-4 flex gap-5">
            {/* Stacked column grows upward from its base; heights are each part's share of the total. */}
            <div aria-hidden="true" className="flex h-44 w-12 shrink-0 flex-col-reverse overflow-hidden rounded-xl border border-line bg-bg">
              {parts.map((p, i) => (
                <div key={p.key} className={`grow-y ${p.bar}`} style={{ height: `${(p.value / result.total) * 100}%`, ["--i" as string]: i }} />
              ))}
            </div>
            <dl className="min-w-0 flex-1 space-y-2 text-sm">
              {parts.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted">
                    <span aria-hidden="true" className={`size-2.5 rounded-sm ${p.bar}`} />
                    {p.key}
                  </dt>
                  <dd className="num font-medium">{formatRupees2(p.value)}</dd>
                </div>
              ))}
              <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold">Estimated total</dt>
                <dd className="num text-2xl font-semibold text-brand-strong">{formatRupees2(result.total)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">Fix the highlighted fields to see an estimate.</p>
        )}
        <p className="mt-5 rounded-xl bg-warn-bg px-3 py-2 text-xs text-warn-ink">
          Indicative only. Rates exclude GST, TCS and other levies; GST at 3% is applied here on gold value plus making charge.
          A jeweller’s final bill can differ (hallmarking, stones, wastage, local charges).
        </p>
      </div>
    </div>
  );
}
