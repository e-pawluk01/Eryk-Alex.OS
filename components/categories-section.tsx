"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MetricCard } from "./metric-card";
import { MetricSection } from "./metric-section";
import { DetailPanel } from "./analytics-details";
import { CategoryChart } from "./charts/category-chart";
import {
  CategorySale, CategoryStats, CategoryMeasure, categoryOf, categoryColor, rankCategories,
} from "@/lib/categories";

export type CategoryCard = "cat-margin" | "cat-sell" | "cat-fast" | "cat-profit";

const MEASURE: Record<CategoryCard, CategoryMeasure> = {
  "cat-margin": "margin", "cat-sell": "sellThrough", "cat-fast": "avgDays", "cat-profit": "profit",
};

const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${Math.round(v)}%`;

interface CategoriesSectionProps {
  loading: boolean;
  stats: CategoryStats[];
  sales: CategorySale[]; // every sale in the last 3 months
  openCard: string | null;
  onToggle: (card: CategoryCard) => void;
}

// CATEGORIES — which kinds of stock earn and sell best, over the last 3 months.
export function CategoriesSection({ loading, stats, sales, openCard, onToggle }: CategoriesSectionProps) {
  const top = (card: CategoryCard) => {
    const best = rankCategories(stats, MEASURE[card])[0];
    return best && best.sold > 0 && (card !== "cat-fast" || best.avgDays !== null) ? best : null;
  };
  const margin = top("cat-margin");
  const sell = top("cat-sell");
  const fast = top("cat-fast");
  const profit = top("cat-profit");
  const open = (Object.keys(MEASURE) as CategoryCard[]).find((c) => c === openCard) ?? null;

  const card = (id: CategoryCard, title: string, best: CategoryStats | null, sub: (c: CategoryStats) => string) => (
    <MetricCard title={title} compact value={best ? best.name : "—"} sub={best ? sub(best) : undefined}
      onClick={best ? () => onToggle(id) : undefined} expanded={open === id} />
  );

  return (
    <MetricSection
      title="Categories"
      loading={loading}
      chart={<CategoryChart stats={stats} />}
      detail={open ? <CategoryTable stats={stats} sales={sales} by={MEASURE[open]} /> : null}
    >
      {card("cat-margin", "Best Margin", margin, (c) => `${pct(c.margin)} margin · ${c.sold} sold`)}
      {card("cat-sell", "Best Sell-Through", sell, (c) => `${pct(c.sellThrough)} · ${c.sold} of ${c.stocked} sold`)}
      {card("cat-fast", "Fastest Seller", fast, (c) => `${Math.round(c.avgDays ?? 0)} days · ${c.sold} sold`)}
      {card("cat-profit", "Most Profit", profit, (c) => `£${Math.round(c.profit).toLocaleString("en-GB")} · ${c.sold} sold`)}
    </MetricSection>
  );
}

// Every category, sorted by the tapped card's measure, then the top 5 flips.
function CategoryTable({ stats, sales, by }: { stats: CategoryStats[]; sales: CategorySale[]; by: CategoryMeasure }) {
  const rows = rankCategories(stats, by);
  const flips = [...sales].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const th = (label: string, measure?: CategoryMeasure, right = true) => (
    <th className={cn("pb-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
      right ? "text-right pl-3" : "text-left pr-3", measure === by ? "text-white" : "text-muted-foreground")}>
      {label}
    </th>
  );
  const td = "py-2.5 border-t border-white/5 tabular-nums text-right pl-3 text-foreground";

  return (
    <DetailPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr>
              {th("Category", undefined, false)}{th("Sold / Stocked")}{th("Profit", "profit")}{th("Avg profit")}
              {th("Margin", "margin")}{th("Days to sell", "avgDays")}{th("Sell-through", "sellThrough")}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name}>
                <td className="py-2.5 border-t border-white/5 pr-3 text-white whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: categoryColor(c.name) }} />
                  {c.name}
                </td>
                <td className={td}>{c.sold}/{c.stocked}</td>
                <td className={td}>£{Math.round(c.profit).toLocaleString("en-GB")}</td>
                <td className={td}>{c.sold > 0 ? `£${money(c.avgProfit)}` : "—"}</td>
                <td className={td}>{c.sold > 0 ? pct(c.margin) : "—"}</td>
                <td className={td}>{c.avgDays !== null ? Math.round(c.avgDays) : "—"}</td>
                <td className={td}>{pct(c.sellThrough)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flips.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-6 mb-3">Top 5 flips</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr>{th("SKU", undefined, false)}{th("Category", undefined, false)}{th("Paid")}{th("Sold for")}{th("Profit")}{th("Margin")}</tr>
              </thead>
              <tbody>
                {flips.map((f, i) => (
                  <tr key={`${f.sku}-${i}`}>
                    <td className="py-2.5 border-t border-white/5 pr-3 text-white">{f.sku}</td>
                    <td className="py-2.5 border-t border-white/5 pr-3 text-foreground">{categoryOf(f.sku)}</td>
                    <td className={td}>£{money(f.buy)}</td>
                    <td className={td}>£{money(f.sold)}</td>
                    <td className={td}>£{money(f.profit)}</td>
                    <td className={td}>{f.sold > 0 ? pct((f.profit / f.sold) * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DetailPanel>
  );
}
