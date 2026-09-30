"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { categoryColor } from "@/lib/categories";
import { Ranking, CategoryRank } from "@/lib/category-ranking";

type Measure = "perItem" | "sellThrough" | "perSale" | "days";

const money = (v: number) => `£${v.toFixed(2)}`;
const short = (name: string) => name.replace(" & t-shirts", "").replace(" & nightwear", "");

// `short` is the switch label on a phone, where the full ones don't fit on one line.
const MEASURES: Record<Measure, { tab: string; short: string; title: string; sub: string }> = {
  perItem: { tab: "Profit / item", short: "Per item", title: "Profit per item stocked", sub: "What an average item earns, sold or not" },
  sellThrough: { tab: "Sell-through", short: "Sell-through", title: "Sell-through", sub: "Share of stocked items that sold" },
  perSale: { tab: "Profit / sale", short: "Per sale", title: "Profit per sale", sub: "Fair figure, real average underneath" },
  days: { tab: "Days to sell", short: "Days", title: "Days to sell", sub: "Days until half have sold, fastest first" },
};

type Row = { c: CategoryRank; value: number | null; label: string; under: string };

function rowsFor(cats: CategoryRank[], m: Measure): Row[] {
  if (m === "days") {
    // Only a category where half have sold has a real answer; the rest keep
    // their row (no bar) and sit underneath, longest waiting first.
    const known = cats.filter((c) => c.daysReached && c.blendedDays !== null).sort((a, b) => a.blendedDays! - b.blendedDays!);
    const waiting = cats.filter((c) => !known.includes(c)).sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
    return [
      ...known.map((c) => ({ c, value: Math.round(c.blendedDays!), label: `${Math.round(c.blendedDays!)} days`, under: `${c.sold} sold` })),
      ...waiting.map((c) => ({ c, value: null, label: "Not known", under: `waiting ${c.days ?? 0} days` })),
    ];
  }
  const get = (c: CategoryRank) => (m === "perItem" ? c.perItem : m === "sellThrough" ? c.sellThrough * 100 : c.perSale);
  return [...cats].sort((a, b) => get(b) - get(a)).map((c) => ({
    c,
    value: get(c),
    label: m === "sellThrough" ? `${get(c).toFixed(1)}%` : money(get(c)),
    under: m === "perSale" ? (c.actualPerSale !== null ? `${money(c.actualPerSale)} actual` : "no sales")
      : `${c.sold} of ${c.stocked}${m === "perItem" ? " sold" : ""}`,
  }));
}

// CATEGORIES — every category with sales as a ranked bar, switchable between
// the four card measures. Rows, order logic and card size stay the same
// whichever measure is showing. Faded bars are early reads; the dashed line
// is the business average.
export function CategoryChart({ ranking }: { ranking: Ranking }) {
  const [measure, setMeasure] = useState<Measure>("perItem");
  const cats = ranking.categories.filter((c) => c.name !== "Other" && c.sold > 0);
  const rows = rowsFor(cats, measure);
  const avg = measure === "perItem" ? ranking.business.perItem
    : measure === "sellThrough" ? ranking.business.sellThrough * 100
    : measure === "perSale" ? ranking.business.perSale : null;
  const max = Math.max(...rows.map((r) => r.value ?? 0), avg ?? 0, 1) * 1.05;
  const info = MEASURES[measure];

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl px-[18px] pt-[18px] pb-4 animate-in fade-in duration-200 flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{info.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info.sub}</p>
        </div>
        <div role="group" aria-label="Measure" className="self-start inline-flex gap-0.5 bg-[#0c0c0c] border border-white/10 rounded-lg p-0.5">
          {(Object.keys(MEASURES) as Measure[]).map((m) => (
            <button key={m} type="button" aria-pressed={m === measure} onClick={() => setMeasure(m)}
              className={cn("text-[11.5px] rounded-md px-2 sm:px-2.5 py-1 transition-colors whitespace-nowrap",
                m === measure ? "bg-[#222] text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <span className="sm:hidden">{MEASURES[m].short}</span>
              <span className="hidden sm:inline">{MEASURES[m].tab}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground/60">No sales in this window yet.</p>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {rows.map(({ c, value, label, under }) => (
            <div key={c.name} className="grid grid-cols-[minmax(0,96px)_minmax(0,1fr)_70px] sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_92px] items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 min-w-0 text-[11.5px] sm:text-[12.5px] text-[#e5e5e5]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryColor(c.name) }} />
                <span className="truncate">{short(c.name)}</span>
              </div>
              <div className="relative h-4 bg-white/[0.035] rounded">
                {value !== null && (
                  <span className={cn("absolute inset-y-0 left-0 rounded-r", c.early && "opacity-40")}
                    style={{ width: `${(value / max) * 100}%`, background: categoryColor(c.name) }} />
                )}
                {avg !== null && (
                  <span className="absolute -inset-y-1 border-l-[1.5px] border-dashed border-[#9a9a9a]" style={{ left: `${(avg / max) * 100}%` }} />
                )}
              </div>
              <div className={cn("text-right text-[12.5px] font-semibold tabular-nums whitespace-nowrap", value === null && "text-muted-foreground font-medium")}>
                {label}
                <span className="block text-[10px] font-medium text-muted-foreground/60">{under}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2 rounded-sm bg-[#c98500]" />Enough data</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2 rounded-sm bg-[#c98500] opacity-40" />Early read</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 border-l-[1.5px] border-dashed border-[#9a9a9a]" />Business average</span>
      </div>
    </div>
  );
}
