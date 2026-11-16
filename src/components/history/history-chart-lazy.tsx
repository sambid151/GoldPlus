"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/states";

/** Recharts is heavy; load it after the shell so rate cards paint first. */
export const HistoryChartLazy = dynamic(() => import("./history-chart"), {
  ssr: false,
  loading: () => <HistoryFallbackBody />,
});

export function HistoryFallbackBody() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading history…">
      <div className="flex gap-3">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-52 w-full" />
    </div>
  );
}
