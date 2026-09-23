"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Breakdown } from "./breakdown";
import { taskColor } from "@/lib/work-sessions";

const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Same surface as a card; sits full-width under a section's cards.
export function DetailPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-5 animate-in fade-in slide-in-from-top-1 duration-200">
      {children}
    </div>
  );
}

interface RevenueSplit {
  cogs: number;
  sellingFees: number;
  shippingCosts: number;
  grossProfit: number;
}

// Where this month's revenue went.
export function RevenueBreakdownPanel({ data }: { data: RevenueSplit }) {
  return (
    <DetailPanel>
      <Breakdown
        format={(v) => `£${money(v)}`}
        items={[
          { label: "Cost of goods", value: data.cogs, color: "#199e70" },
          { label: "Selling fees", value: data.sellingFees, color: "#c98500" },
          { label: "Shipping", value: data.shippingCosts, color: "#d55181" },
          { label: "Gross profit", value: data.grossProfit, color: "#d95926", strong: true },
        ]}
      />
    </DetailPanel>
  );
}

// Every task this month by hours.
export function TaskBreakdownPanel({ tasks }: { tasks: { task: string; hours: number }[] }) {
  return (
    <DetailPanel>
      <Breakdown
        format={(v) => `${v.toFixed(1)}h`}
        items={tasks.map((t) => ({ label: t.task, value: t.hours, color: taskColor(t.task) }))}
      />
    </DetailPanel>
  );
}

interface Sale {
  sku: string;
  buy: number;
  sold: number;
  profit: number;
  tts: string | number;
  soldOn?: string | null; // "yyyy-MM-dd"
}

const INITIAL_SALES = 8;

// This month's sales, newest first.
export function SalesTablePanel({ sales }: { sales: Sale[] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...sales].sort((a, b) => (b.soldOn ?? "").localeCompare(a.soldOn ?? ""));
  const rows = showAll ? sorted : sorted.slice(0, INITIAL_SALES);
  const th = "pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground";
  const td = "py-2.5 border-t border-white/5 tabular-nums";

  if (sales.length === 0) {
    return (
      <DetailPanel>
        <p className="text-[13px] text-muted-foreground/60">No sales yet this month.</p>
      </DetailPanel>
    );
  }

  return (
    <DetailPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13px] text-left">
          <thead>
            <tr>
              <th className={cn(th, "pr-3")}>SKU</th>
              <th className={cn(th, "pr-3")}>Sold</th>
              <th className={cn(th, "text-right pl-3")}>Paid</th>
              <th className={cn(th, "text-right pl-3")}>Sold for</th>
              <th className={cn(th, "text-right pl-3")}>Profit</th>
              <th className={cn(th, "text-right pl-3")}>Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={`${s.sku}-${i}`}>
                <td className={cn(td, "pr-3 text-white")}>{s.sku}</td>
                <td className={cn(td, "pr-3 text-foreground")}>
                  {s.soldOn ? format(new Date(`${s.soldOn}T12:00`), "d MMM") : "—"}
                </td>
                <td className={cn(td, "pl-3 text-right text-foreground")}>£{money(s.buy)}</td>
                <td className={cn(td, "pl-3 text-right text-foreground")}>£{money(s.sold)}</td>
                <td className={cn(td, "pl-3 text-right", s.profit < 0 ? "text-red-400/80" : "text-white")}>
                  {s.profit < 0 ? "−" : ""}£{money(Math.abs(s.profit))}
                </td>
                <td className={cn(td, "pl-3 text-right text-foreground")}>{s.tts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && sales.length > INITIAL_SALES && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
        >
          Show all {sales.length}
        </button>
      )}
    </DetailPanel>
  );
}
