"use client";

import React, { useEffect, useState } from "react";
import { LayoutGrid, ChartColumn } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricSectionProps {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
  // Expanded card details, shown full-width under the cards.
  detail?: React.ReactNode;
  // When given, the heading gets grid/chart icons that swap the cards for this.
  chart?: React.ReactNode;
}

const storageKey = (title: string) => `analytics-view:${title}`;

// Shared wrapper for a titled block of MetricCards on the analytics dashboard.
// Matches the existing heading + 2x4 grid pattern; first section sits flush,
// the rest are separated by mt-8.
export function MetricSection({ title, loading, children, detail, chart }: MetricSectionProps) {
  const [showChart, setShowChart] = useState(false);

  // Each section remembers numbers vs chart on this device.
  useEffect(() => {
    try { setShowChart(localStorage.getItem(storageKey(title)) === "chart"); } catch {}
  }, [title]);

  const choose = (asChart: boolean) => {
    setShowChart(asChart);
    try { localStorage.setItem(storageKey(title), asChart ? "chart" : "numbers"); } catch {}
  };

  const iconButton = (active: boolean) =>
    cn(
      "w-7 h-6 grid place-items-center rounded-md transition-colors",
      active ? "bg-white/10 text-white" : "text-muted-foreground/50 hover:text-white"
    );

  return (
    <div className="flex flex-col gap-4 mt-8 first:mt-0">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
        {chart && (
          <div role="group" aria-label={`${title} view`} className="flex gap-0.5 p-0.5 rounded-lg border border-white/10 bg-white/[0.04]">
            <button type="button" onClick={() => choose(false)} aria-pressed={!showChart}
              aria-label={`Show ${title} as numbers`} title="Numbers" className={iconButton(!showChart)}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => choose(true)} aria-pressed={showChart}
              aria-label={`Show ${title} as a chart`} title="Chart" className={iconButton(showChart)}>
              <ChartColumn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {chart && showChart ? (
        chart
      ) : (
        <>
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity duration-300 ${
              loading ? "opacity-50" : "opacity-100"
            }`}
          >
            {children}
          </div>
          {detail}
        </>
      )}
    </div>
  );
}
