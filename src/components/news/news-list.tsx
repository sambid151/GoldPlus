"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { FACTORS, type FactorKey } from "@/lib/news/factors";
import type { NewsItem } from "@/lib/news/rss";
import { formatIst } from "@/lib/time";
import { EmptyState } from "@/components/ui/states";

const LABEL = Object.fromEntries(FACTORS.map((f) => [f.key, f.label])) as Record<FactorKey, string>;

export function NewsList({ items }: { items: NewsItem[] }) {
  const [active, setActive] = useState<FactorKey | "all">("all");

  const counts = useMemo(() => {
    const c = Object.fromEntries(FACTORS.map((f) => [f.key, 0])) as Record<FactorKey, number>;
    for (const i of items) for (const f of i.factors) c[f]++;
    return c;
  }, [items]);

  const visible = active === "all" ? items : items.filter((i) => i.factors.includes(active));

  return (
    <div>
      <div role="group" aria-label="Filter headlines by factor" className="mb-4 flex flex-wrap gap-2">
        <Chip on={active === "all"} onClick={() => setActive("all")}>All <span className="num opacity-70">{items.length}</span></Chip>
        {FACTORS.map((f) => (
          <Chip key={f.key} on={active === f.key} disabled={counts[f.key] === 0} onClick={() => setActive(f.key)} title={f.hint}>
            {f.label} <span className="num opacity-70">{counts[f.key]}</span>
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No headlines for this factor this week" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-bg shadow-card">
          {visible.map((n) => (
            <li key={n.link} className="p-4 transition-colors hover:bg-brand-wash sm:p-5">
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium leading-snug group-hover:text-brand-strong">{n.title}</span>
                <ExternalLink aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className="font-medium text-ink/80">{n.source}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={n.publishedAt}>{formatIst(n.publishedAt)}</time>
              </p>
              {n.factors.length > 0 ? (
                <ul aria-label="Mentioned factors" className="mt-2 flex flex-wrap gap-1.5">
                  {n.factors.map((f) => (
                    <li key={f} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">{LABEL[f]}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ on, disabled, onClick, title, children }: {
  on: boolean; disabled?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`min-h-9 cursor-pointer rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-action bg-action text-on-action" : "border-line bg-bg text-muted hover:bg-brand-soft hover:text-brand-strong"
      }`}
    >
      {children}
    </button>
  );
}
