"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "@/app/data/actions";
import { formatRupees } from "@/lib/format";
import { formatShortDate } from "@/lib/time";
import { KARATS } from "@/lib/types";

const idle: ImportState = { status: "idle" };
const PLACEHOLDER = "Date\t24K\t22K\nNov 16, 2026\t₹13,680\t₹12,540";

export function ImportPanel() {
  const [state, action, pending] = useActionState(importAction, idle);
  const checks = state.checks ?? [];
  const blocked = Boolean(state.storeError) || checks.some((c) => c.errors.length > 0);
  const needsConfirm = checks.some((c) => c.confirm.length > 0);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="intent" value="preview" />
        <div>
          <label htmlFor="import-text" className="text-sm font-semibold">Paste a copied table</label>
          <textarea
            id="import-text"
            name="text"
            rows={6}
            spellCheck={false}
            autoComplete="off"
            placeholder={PLACEHOLDER}
            className="num mt-2 block w-full rounded-xl border border-line bg-bg p-3 text-base"
          />
          <p className="mt-1 text-sm text-muted">Copy the table from the rates page and paste it here. Prices in brackets (the daily change) are ignored.</p>
        </div>
        <div>
          <label htmlFor="import-file" className="text-sm font-semibold">Or upload a file</label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".html,.htm,.csv,.json,.txt,text/html,text/csv,application/json,text/plain"
            className="mt-2 block min-h-11 w-full cursor-pointer rounded-xl border border-line bg-bg p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-medium file:text-brand-strong"
          />
          <p className="mt-1 text-sm text-muted">A saved rates page (.html), a CSV with the columns date, 24K, 22K, 18K, or a GoldPulse JSON export.</p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 cursor-pointer rounded-xl border border-brand-strong px-5 font-semibold text-brand-strong transition-colors hover:bg-brand-soft disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Working…" : "Preview"}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {state.status === "error" ? <p className="text-sm text-down">{state.message}</p> : null}
        {state.status === "saved" ? <p className="text-sm font-medium text-up">{state.message}</p> : null}
      </div>
      {state.problems && state.problems.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-muted">{state.problems.map((p) => <li key={p}>{p}</li>)}</ul>
      ) : null}

      {state.status === "preview" && checks.length > 0 ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="intent" value="commit" />
          <input type="hidden" name="payload" value={state.payload} />
          {state.storeError ? <p role="alert" className="text-sm text-down">{state.storeError}</p> : null}
          {state.message ? <p role="alert" className="text-sm text-down">{state.message}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <caption className="sr-only">Preview of rates to save</caption>
              <thead className="bg-surface text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Date</th>
                  {KARATS.map((k) => <th key={k} scope="col" className="px-3 py-2 text-right font-medium">{k}</th>)}
                  <th scope="col" className="px-3 py-2 font-medium">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {checks.map((c) => (
                  <tr key={c.row.date}>
                    <th scope="row" className="px-3 py-2 font-medium">
                      {formatShortDate(c.row.date)}
                      {c.row.dateAssumed ? " (assumed today)" : ""}
                    </th>
                    {KARATS.map((k) => (
                      <td key={k} className="num px-3 py-2 text-right">{c.row.prices[k] ? formatRupees(c.row.prices[k]!) : "—"}</td>
                    ))}
                    <td className="px-3 py-2">
                      {c.errors.length > 0 ? (
                        <span className="text-down">{c.errors[0]}</span>
                      ) : c.confirm.length > 0 ? (
                        <span className="text-down">Unusual: check it</span>
                      ) : c.identical ? (
                        <span className="text-muted">Already stored</span>
                      ) : Object.keys(c.replaces).length > 0 ? (
                        <span className="text-muted">Replaces a stored day</span>
                      ) : (
                        <span className="text-up">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needsConfirm && !blocked ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="confirmed" value="1" required className="size-5 accent-[var(--brand)]" />
              Some values look unusual. I checked them and want to save.
            </label>
          ) : null}
          <button
            type="submit"
            disabled={blocked || pending}
            className="min-h-11 cursor-pointer rounded-xl bg-action px-5 font-semibold text-on-action transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : `Save ${checks.length} day${checks.length === 1 ? "" : "s"}`}
          </button>
          {blocked ? <p className="text-sm text-muted">Fix the problems in the file, then preview again.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
