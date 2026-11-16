import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-down/40 bg-down-soft p-5 text-sm">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-down" />
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        {children ? <div className="mt-1 text-muted break-words">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-strong">
        <Inbox aria-hidden="true" className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-muted">{children}</div> : null}
    </div>
  );
}
