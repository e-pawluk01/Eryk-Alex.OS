"use client";

import React from "react";
import { ChartFrame, AXIS_TEXT, LABEL_TEXT, GRID_LINE } from "./chart-frame";
import { useHoverTip } from "../ui/hover-tip";
import { categoryColor } from "@/lib/categories";
import { Ranking } from "@/lib/category-ranking";

const HEIGHT = 380;
const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (name: string) => name.replace(" & t-shirts", "").replace(" & nightwear", "").replace(" & Sweaters", "");

// CATEGORIES — each category as a bubble: across = sell-through, up = profit
// per sale, size = items stocked. The dashed lines are the business averages,
// so top-right is "source more" and bottom-left "source less". Early reads
// are drawn as outlines. Categories with no sales yet have nothing to plot.
export function CategoryChart({ ranking }: { ranking: Ranking }) {
  const cats = ranking.categories.filter((c) => c.name !== "Other" && c.sold > 0);
  const { bind, layer } = useHoverTip();

  return (
    <ChartFrame title="Category performance" height={HEIGHT} empty={cats.length === 0 ? "No sales in this window yet." : undefined}>
      {(width) => {
        const pad = { t: 16, r: 18, b: 34, l: 52 };
        const pw = width - pad.l - pad.r, ph = HEIGHT - pad.t - pad.b;
        const xs = cats.map((c) => c.sellThrough), ys = cats.map((c) => c.perSale);
        const x0 = Math.min(...xs) - 0.03, x1 = Math.max(...xs) + 0.03;
        const y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
        const X = (v: number) => pad.l + ((v - x0) / (x1 - x0 || 1)) * pw;
        const Y = (v: number) => pad.t + ph - ((v - y0) / (y1 - y0 || 1)) * ph;
        const maxStock = Math.max(...cats.map((c) => c.stocked), 1);
        const R = (n: number) => 5 + 17 * Math.sqrt(n / maxStock);
        const avgX = X(ranking.business.sellThrough), avgY = Y(ranking.business.perSale);
        const narrow = width < 560; // only room for the two corners that matter most
        const corner = (x: number, y: number, text: string, anchor: "start" | "end") => (
          <text x={x} y={y} fontSize={10} fill="#6f6f6f" textAnchor={anchor} fontWeight={600} letterSpacing=".06em">{text.toUpperCase()}</text>
        );
        const xTicks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].filter((v) => v > x0 && v < x1);
        const yTicks: number[] = [];
        for (let v = Math.ceil(y0); v <= y1; v += 2) yTicks.push(v);

        return (
          <>
            <svg width={width} height={HEIGHT} role="img" aria-label="Categories by sell-through and profit per sale" className="block">
              <rect x={pad.l} y={pad.t} width={pw} height={ph} fill="none" stroke={GRID_LINE} />
              <line x1={avgX} x2={avgX} y1={pad.t} y2={pad.t + ph} stroke="#6b6b6b" strokeDasharray="4 4" />
              <line x1={pad.l} x2={pad.l + pw} y1={avgY} y2={avgY} stroke="#6b6b6b" strokeDasharray="4 4" />
              {corner(pad.l + pw - 6, pad.t + 14, "Source more", "end")}
              {!narrow && corner(pad.l + 6, pad.t + 14, "Sells slowly, earns well", "start")}
              {corner(pad.l + 6, pad.t + ph - 8, "Source less", "start")}
              {!narrow && corner(pad.l + pw - 6, pad.t + ph - 8, "Sells fast, but cheap", "end")}
              {xTicks.map((v) => (
                <text key={v} x={X(v)} y={HEIGHT - 14} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>{Math.round(v * 100)}%</text>
              ))}
              {yTicks.map((v) => (
                <text key={v} x={pad.l - 8} y={Y(v) + 3} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>£{v}</text>
              ))}
              <text x={pad.l + pw / 2} y={HEIGHT - 1} textAnchor="middle" fontSize={10} fill={LABEL_TEXT}>Sell-through →</text>
              <text x={12} y={pad.t + ph / 2} fontSize={10} fill={LABEL_TEXT} textAnchor="middle"
                transform={`rotate(-90 12 ${pad.t + ph / 2})`}>Profit per sale →</text>
              {[...cats].sort((a, b) => b.stocked - a.stocked).map((c) => {
                const cx = X(c.sellThrough), cy = Y(c.perSale), r = R(c.stocked), color = categoryColor(c.name);
                const tip = `${c.name}${c.early ? " · Early read" : ""}\nSell-through ${(c.sellThrough * 100).toFixed(1)}% (${c.sold}/${c.stocked})\nProfit per sale £${money(c.perSale)}\nProfit per item stocked £${money(c.perItem)}`;
                const right = cx < pad.l + pw * 0.8;
                return (
                  <g key={c.name}>
                    {c.early
                      ? <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={2} {...bind(tip)} />
                      : <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.85} stroke="#111" strokeWidth={1.5} {...bind(tip)} />}
                    <text x={cx + (right ? r + 5 : -r - 5)} y={cy + 3.5} textAnchor={right ? "start" : "end"}
                      fontSize={10.5} fill="#cfcfcf" pointerEvents="none">{short(c.name)}</text>
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
