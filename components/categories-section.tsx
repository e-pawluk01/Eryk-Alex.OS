"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MetricCard, EarlyBadge } from "./metric-card";
import { MetricSection } from "./metric-section";
import { DetailPanel } from "./analytics-details";
import { CategoryChart } from "./charts/category-chart";
import { CategorySale, categoryOf, categoryColor, hasSku } from "@/lib/categories";
import { Ranking, CategoryRank, RankKey, sortCategories, bestCategory } from "@/lib/category-ranking";

export type CategoryCard = "cat-item" | "cat-sell" | "cat-sale" | "cat-fast";

const KEY: Record<CategoryCard, RankKey> = {
  "cat-item": "perItem", "cat-sell": "sellThrough", "cat-sale": "perSale", "cat-fast": "days",
};

const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
// Half the category has sold: its median. Otherwise the longest it has waited.
const daysText = (c: CategoryRank, ranking: Ranking) =>
  c.daysReached && c.blendedDays !== null
    ? `${Math.round(c.blendedDays)} days`
    : `over ${Math.round(c.days ?? ranking.business.medianDays ?? 0)} days`;

interface CategoriesSectionProps {
  loading: boolean;
  ranking: Ranking;
  sales: CategorySale[]; // every sale in the window, for the top flips
  openCard: string | null;
  onToggle: (card: CategoryCard) => void;
}

// CATEGORIES — which kinds of stock earn and sell best, ranked fairly so a
// small category can't win on luck (see lib/category-ranking.ts).
export function CategoriesSection({ loading, ranking, sales, openCard, onToggle }: CategoriesSectionProps) {
  const open = (Object.keys(KEY) as CategoryCard[]).find((c) => c === openCard) ?? null;

  const card = (id: CategoryCard, title: string, sub: (c: CategoryRank) => string) => {
    const best = bestCategory(ranking.categories, KEY[id]);
    return (
      <MetricCard title={title} compact value={best ? best.name : "—"} sub={best ? sub(best) : undefined}
        badge={best?.early ? "Early read" : undefined}
        onClick={best ? () => onToggle(id) : undefined} expanded={open === id} />
    );
  };

  return (
    <MetricSection
      title="Categories"
      loading={loading}
      chart={<CategoryChart ranking={ranking} />}
      detail={open ? <CategoryTable ranking={ranking} sales={sales} by={KEY[open]} /> : null}
    >
      {card("cat-item", "Profit per Item Stocked", (c) => `£${money(c.perItem)} per item · ${c.sold} of ${c.stocked} sold`)}
      {card("cat-sell", "Sell-Through", (c) => `${pct(c.sellThrough)} · ${c.sold} of ${c.stocked} sold`)}
      {card("cat-sale", "Profit per Sale", (c) => `£${money(c.perSale)} per sale · ${c.sold} sold`)}
      {card("cat-fast", "Fastest Seller", (c) => `${daysText(c, ranking)} · ${c.sold} sold`)}
    </MetricSection>
  );
}

// Every category, sorted by the tapped card's measure, then the top 5 flips.
function CategoryTable({ ranking, sales, by }: { ranking: Ranking; sales: CategorySale[]; by: RankKey }) {
  const rows = sortCategories(ranking.categories, by);
  const flips = sales.filter((s) => hasSku(s.sku)).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const th = (label: string, key?: RankKey, right = true) => (
    <th className={cn("pb-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
      right ? "text-right pl-3" : "text-left pr-3", key === by ? "text-white" : "text-muted-foreground")}>
      {label}
    </th>
  );
  const td = "py-2.5 border-t border-white/5 tabular-nums text-right pl-3 text-foreground align-top";
  const under = "block text-[11px] text-muted-foreground/60";
  const signal: Record<CategoryRank["signal"], string> = {
    More: "text-emerald-400/90", Less: "text-red-400/80", Watch: "text-muted-foreground",
  };

  return (
    <DetailPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr>
              {th("Category", undefined, false)}{th("Signal", undefined, false)}{th("Profit / item stocked", "perItem")}
              {th("Sell-through", "sellThrough")}{th("Profit / sale", "perSale")}{th("Median days", "days")}
              {th("Aged")}{th("Total profit")}{th("ABC")}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name}>
                <td className="py-2.5 border-t border-white/5 pr-3 text-white whitespace-nowrap align-top">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: categoryColor(c.name) }} />
                  {c.name}
                  {c.early && <EarlyBadge label="Early read" className="ml-2 align-[1px]" />}
                </td>
                <td className={cn("py-2.5 border-t border-white/5 pr-3 align-top font-semibold", signal[c.signal])}>{c.signal}</td>
                <td className={td}>£{money(c.perItem)}</td>
                <td className={td}>{pct(c.sellThrough)}<span className={under}>{c.sold} / {c.stocked}</span></td>
                <td className={td}>
                  £{money(c.perSale)}
                  <span className={under}>{c.actualPerSale === null ? "no sales" : `£${money(c.actualPerSale)} actual`}</span>
                </td>
                <td className={td}>{daysText(c, ranking)}</td>
                <td className={td}>{c.aged ?? "—"}</td>
                <td className={td}>£{Math.round(c.profit).toLocaleString("en-GB")}</td>
                <td className={td}>{c.abc}</td>
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
                    <td className="py-2.5 border-t border-white/5 pr-3 text-foreground">{categoryOf(f.sku, f.note)}</td>
                    <td className={td}>£{money(f.buy)}</td>
                    <td className={td}>£{money(f.sold)}</td>
                    <td className={td}>£{money(f.profit)}</td>
                    <td className={td}>{f.sold > 0 ? `${Math.round((f.profit / f.sold) * 100)}%` : "—"}</td>
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
