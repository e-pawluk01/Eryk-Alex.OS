"use client";

import React from "react";
import { ChartFrame, rightRoundedBar } from "./chart-frame";
import { useHoverTip } from "../ui/hover-tip";
import type { StockHealth } from "@/lib/stock-health";

const ADDED = "#3987e5";
const SOLD = "#d95926";

// STOCK HEALTH — items that came into the sheet next to items that left,
// over the same window.
export function StockFlowChart({ health }: { health: StockHealth }) {
  const { added, window } = health;
  const rows = [
    { label: "Added", value: added.added, color: ADDED },
    { label: "Sold", value: added.sold, color: SOLD },
  ];
  const { bind, layer } = useHoverTip();
  const height = 120;

  return (
    <ChartFrame title="Items added vs sold" sub={window.rolling ? "Last 30 days" : "This month so far"} height={height}>
      {(width) => {
        const labelW = 72, valueW = 48;
        const plotW = Math.max(40, width - labelW - valueW);
        const max = Math.max(...rows.map((r) => r.value), 1);
        return (
          <>
            <svg width={width} height={height} role="img" aria-label="Items added vs items sold" className="block">
              {rows.map((r, i) => {
                const y = 20 + i * 44, w = (r.value / max) * plotW;
                return (
                  <g key={r.label}>
                    <text x={0} y={y + 14} fontSize={12} fill="#e5e5e5">{r.label}</text>
                    <rect x={labelW} y={y} width={plotW} height={20} rx={4} fill="rgba(255,255,255,0.04)" />
                    <path d={rightRoundedBar(labelW, y, w, 20)} fill={r.color} {...bind(`${r.label}: ${r.value} items`)} />
                    <text x={labelW + w + 8} y={y + 14} fontSize={12} fontWeight={600} fill="#ffffff">{r.value}</text>
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
