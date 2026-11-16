"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveRateAction, type FormState } from "@/app/data/actions";

interface Props {
  today: string;
  /** Prefill when editing a stored day. */
  initial?: { date: string; "24K"?: number; "22K"?: number; "18K"?: number };
}

const FIELDS = [
  { name: "24K", label: "24K price per gram", required: true },
  { name: "22K", label: "22K price per gram" },
  { name: "18K", label: "18K price per gram" },
] as const;

export function RateForm({ today, initial }: Props) {
  const idle: FormState = {
    status: "idle",
    values: {
      date: initial?.date ?? today,
      "24K": initial?.["24K"]?.toString() ?? "",
      "22K": initial?.["22K"]?.toString() ?? "",
      "18K": initial?.["18K"]?.toString() ?? "",
    },
  };
  const [state, action, pending] = useActionState(saveRateAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move focus to the first problem so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (state.status !== "error" && state.status !== "confirm") return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], input[name="confirmed"]')?.focus();
  }, [state]);
  const v = state.values ?? idle.values!;
  const errs = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="rate-date" className="text-sm font-semibold">Date</label>
        <input
          id="rate-date"
          name="date"
          type="date"
          max={today}
          required
          defaultValue={v.date}
          autoComplete="off"
          aria-invalid={errs.date ? true : undefined}
          aria-describedby={errs.date ? "rate-date-err" : undefined}
          className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base sm:w-56"
        />
        {errs.date ? <p id="rate-date-err" className="mt-1 text-sm text-down">{errs.date}</p> : null}
      </div>

      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={`rate-${f.name}`} className="text-sm font-semibold">
            {f.label}
            {"required" in f ? <span className="text-down"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
          </label>
          <div className="relative mt-2">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span>
            <input
              id={`rate-${f.name}`}
              name={f.name}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              defaultValue={v[f.name]}
              placeholder="13680"
              aria-invalid={errs[f.name] ? true : undefined}
              aria-describedby={errs[f.name] ? `rate-${f.name}-err` : undefined}
              className="num block min-h-11 w-full rounded-xl border border-line bg-bg pl-8 pr-3 text-base"
            />
          </div>
          {errs[f.name] ? <p id={`rate-${f.name}-err`} className="mt-1 text-sm text-down">{errs[f.name]}</p> : null}
        </div>
      ))}

      <div className="sm:col-span-2">
        {state.status === "confirm" ? (
          <div role="alert" className="mb-3 rounded-xl border border-down/40 bg-down-soft p-4 text-sm">
            <p className="font-semibold">These values look unusual</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{state.confirm?.map((c) => <li key={c}>{c}</li>)}</ul>
            <label className="mt-3 flex cursor-pointer items-center gap-2 font-medium">
              <input type="checkbox" name="confirmed" value="1" required className="size-5 accent-[var(--brand)]" />
              I checked them. Save anyway.
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-xl bg-action px-5 font-semibold text-on-action transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : state.status === "confirm" ? "Save these rates" : "Save rates"}
          </button>
          <p role="status" aria-live="polite" className={`text-sm ${state.status === "saved" ? "text-up" : state.status === "error" ? "text-down" : "text-muted"}`}>
            {state.message}
          </p>
        </div>
      </div>
    </form>
  );
}
