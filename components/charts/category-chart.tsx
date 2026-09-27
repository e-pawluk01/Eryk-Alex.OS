"use client";

import React from "react";
import { ChartFrame, rightRoundedBar } from "./chart-frame";
import { useHoverTip } from "../ui/hover-tip";
import { CategoryStats, categoryColor } from "@/lib/categories";

const ROW = 24;

// CATEGORIES — profit per category over the window, each in its own colour,
// with the margin written after the bar.
export function CategoryChart({ stats }: { stats: CategoryStats[] }) {
  const rows = stats.filter((c) => c.sold > 0).sort((a, b) => b.profit - a.profit);
  const height = 20 + rows.length * ROW;
  const { bind, layer } = useHoverTip();

  return (
    <ChartFrame
      title="Profit by category, last 3 months"
      height={Math.max(height, 120)}
      empty={rows.length === 0 ? "No sales in the last 3 months." : undefined}
    >
      {(width) => {
        const labelW = width < 420 ? 112 : 150;
        const plotW = Math.max(40, width - labelW - 100);
        const max = Math.max(...rows.map((r) => Math.max(0, r.profit)), 1);
        return (
          <>
            <svg width={width} height={height} role="img" className="block">
              {rows.map((r, i) => {
                const y = 10 + i * ROW;
                const w = (Math.max(0, r.profit) / max) * plotW;
                const tip = `${r.name}\n£${Math.round(r.profit)} profit · ${r.margin.toFixed(0)}% margin\n${r.sold}/${r.stocked} sold · ${r.sellThrough.toFixed(0)}% sell-through`;
                return (
                  <g key={r.name}>
                    <text x={0} y={y + 11} fontSize={11.5} fill="#e5e5e5">{r.name}</text>
                    <rect x={labelW} y={y} width={plotW} height={14} rx={4} fill="rgba(255,255,255,0.04)" />
                    <path d={rightRoundedBar(labelW, y, w, 14)} fill={categoryColor(r.name)} {...bind(tip)} />
                    <text x={labelW + w + 7} y={y + 11} fontSize={11.5} fontWeight={600} fill="#ffffff">
                      £{Math.round(r.profit).toLocaleString("en-GB")}
                      <tspan fill="#8a8a8a" fontWeight={400}> · {r.margin.toFixed(0)}%</tspan>
                    </text>
                  </g>
                );
              })}
            </svg>
            {layer}
          </>
        );
      }}
    </ChartFrame>
  );
}
