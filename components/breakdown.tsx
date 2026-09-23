"use client";

import React from "react";
import { useHoverTip } from "./ui/hover-tip";
import { cn } from "@/lib/utils";

export interface BreakdownItem {
  label: string;
  value: number;
  color: string;
  strong?: boolean;
}

interface BreakdownProps {
  items: BreakdownItem[];
  format: (value: number) => string;
}

// The one pattern every expanded card uses: a stacked colour bar, then a
// list with matching dots, amounts and each item's share.
export function Breakdown({ items, format }: BreakdownProps) {
  const total = items.reduce((acc, it) => acc + it.value, 0);
  const shown = items.filter((it) => it.value > 0);
  const { bind, layer } = useHoverTip();
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-col">
      <div className="flex gap-0.5 h-2.5 mb-3.5">
        {shown.map((it) => (
          <i
            key={it.label}
            {...bind(`${it.label}\n${format(it.value)} · ${pct(it.value)}%`)}
            className="block h-full min-w-[3px] first:rounded-l last:rounded-r"
            style={{ flex: it.value, background: it.color }}
          />
        ))}
      </div>
      {shown.map((it) => (
        <div key={it.label} className="grid grid-cols-[8px_minmax(0,1fr)_auto_44px] gap-3 items-center py-[7px] text-[13px]">
          <span className="w-2 h-2 rounded-full" style={{ background: it.color }} />
          <span className={cn("truncate", it.strong ? "text-white font-semibold" : "text-foreground")}>{it.label}</span>
          <span className={cn("text-right tabular-nums text-white", it.strong && "font-semibold")}>{format(it.value)}</span>
          <span className="text-right tabular-nums text-xs text-muted-foreground/50">
            {pct(it.value)}%
          </span>
        </div>
      ))}
      {layer}
    </div>
  );
}
