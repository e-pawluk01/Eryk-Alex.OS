"use client";

import React from "react";
import { MetricCard } from "./metric-card";
import { MetricSection } from "./metric-section";
import { DetailPanel } from "./analytics-details";
import { Breakdown } from "./breakdown";
import { StockFlowChart } from "./charts/stock-flow-chart";
import { categoryOf } from "@/lib/categories";
import type { StockHealth } from "@/lib/stock-health";

export type HealthCard = "health-sell" | "health-days" | "health-aged" | "health-added";

const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
const COLLECTING = "Collecting data";

interface StockHealthSectionProps {
  loading: boolean;
  health: StockHealth;
  openCard: string | null;
  onToggle: (card: HealthCard) => void;
}

// STOCK HEALTH — the stock as a whole: how much of it sells, how fast, what's
// gone stale, and whether it's growing. Last 30 days (this month's tab until
// exit dates cover 30 days).
export function StockHealthSection({ loading, health, openCard, onToggle }: StockHealthSectionProps) {
  const { sellThrough: st, daysToSell: dts, aged, added } = health;
  const tap = (card: HealthCard) => () => onToggle(card);
  const open = (["health-sell", "health-days", "health-aged", "health-added"] as HealthCard[]).find((c) => c === openCard) ?? null;

  return (
    <MetricSection
      title="Stock Health"
      loading={loading}
      chart={<StockFlowChart health={health} />}
      detail={open ? <HealthDetail card={open} health={health} /> : null}
    >
      <MetricCard title="Sell-Through"
        value={st.value !== null ? (st.value * 100).toFixed(1) : "—"} suffix={st.value !== null ? "%" : undefined}
        sub={`${st.sold} of ${st.sold + st.stock + st.removed}`}
        onClick={tap("health-sell")} expanded={open === "health-sell"} />
      {dts.status === "ready"
        ? <MetricCard title="Days to Sell" value={dts.reached ? dts.median : `Over ${dts.median}`} suffix=" days"
            onClick={tap("health-days")} expanded={open === "health-days"} />
        : <MetricCard title="Days to Sell" value="—" sub={COLLECTING} />}
      {aged.status === "ready"
        ? <MetricCard title="Aged Stock" value={aged.count} suffix=" items"
            sub={`£${money(aged.cash)} tied up`}
            onClick={tap("health-aged")} expanded={open === "health-aged"} />
        : <MetricCard title="Aged Stock" value="—" sub={COLLECTING} />}
      <MetricCard title="Items Added" value={added.added}
        sub={`${added.sold} sold · ${signed(added.net)} net`}
        onClick={tap("health-added")} expanded={open === "health-added"} />
    </MetricSection>
  );
}

function Figures({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="border border-white/5 rounded-lg px-3.5 py-3 flex flex-col gap-1.5">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function HealthDetail({ card, health }: { card: HealthCard; health: StockHealth }) {
  const { sellThrough: st, daysToSell: dts, aged, added } = health;
  const td = "py-2.5 border-t border-white/5 tabular-nums text-right pl-3 text-foreground";
  const th = "pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";

  if (card === "health-sell") {
    return (
      <DetailPanel>
        <Breakdown format={(v) => `${v} items`} items={[
          { label: "Sold", value: st.sold, color: "#d95926", strong: true },
          { label: "Still in stock", value: st.stock, color: "#3987e5" },
          { label: "Removed", value: st.removed, color: "#8a8f98" },
        ]} />
      </DetailPanel>
    );
  }
  if (card === "health-days" && dts.status === "ready") {
    return (
      <DetailPanel>
        <Figures rows={[["Sales measured", `${dts.measured}`], ["Still listed, counted so far", `${dts.listed}`], ["Counted from", "Days listed"]]} />
      </DetailPanel>
    );
  }
  if (card === "health-aged" && aged.status === "ready") {
    return (
      <DetailPanel>
        <Figures rows={[["Cash tied up", `£${money(aged.cash)}`], ["Value sitting", `£${money(aged.value)}`], ["Aged after", `${Math.round(aged.line)} days`]]} />
        {aged.oldest.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-6 mb-3">Oldest items</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pr-3`}>SKU</th><th className={`${th} text-left pr-3`}>Category</th>
                    <th className={`${th} text-right pl-3`}>Days listed</th><th className={`${th} text-right pl-3`}>Paid</th>
                    <th className={`${th} text-right pl-3`}>ESP</th>
                  </tr>
                </thead>
                <tbody>
                  {aged.oldest.map((i, n) => (
                    <tr key={`${i.sku}-${n}`}>
                      <td className="py-2.5 border-t border-white/5 pr-3 text-white">{i.sku || "—"}</td>
                      <td className="py-2.5 border-t border-white/5 pr-3 text-foreground">{categoryOf(i.sku)}</td>
                      <td className={td}>{i.days}</td>
                      <td className={td}>£{money(i.buy)}</td>
                      <td className={td}>{i.esp !== null ? `£${money(i.esp)}` : "—"}</td>
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
  if (card === "health-added") {
    return (
      <DetailPanel>
        <Figures rows={[
          ["Items added", `${added.added}`],
          ["Items sold", `${added.sold}`],
          ["Net change in stock", signed(added.net)],
          ["Months of cover", added.cover !== null ? added.cover.toFixed(1) : "—"],
        ]} />
      </DetailPanel>
    );
  }
  return null;
}
