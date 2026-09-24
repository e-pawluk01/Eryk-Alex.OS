"use client";

import React from "react";
import { endOfMonth, format } from "date-fns";
import { ChartFrame } from "./chart-frame";
import { ColumnChart, HorizontalBars } from "./column-chart";
import { WorkSession, taskColor } from "@/lib/work-sessions";
import { hoursByTask } from "@/lib/analytics-data";

const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyAxis = (v: number) => (v >= 1000 ? `£${v / 1000}k` : `£${v}`);
const REVENUE = "#3987e5";
const PROFIT = "#d95926";
const OTHER = "#555553";

// PERFORMANCE — revenue and gross profit, closed months plus this month live.
export function PerformanceChart({ history }: { history: { label: string; revenue: number; grossProfit: number; live?: boolean }[] }) {
  const liveLabel = history.find((h) => h.live)?.label;
  return (
    <ChartFrame
      title={`Revenue and gross profit, last ${history.length} month${history.length === 1 ? "" : "s"}`}
      sub={liveLabel ? `${liveLabel} is month-to-date` : undefined}
      legend={[{ label: "Revenue", color: REVENUE }, { label: "Gross profit", color: PROFIT }]}
    >
      {(width) => (
        <ColumnChart
          width={width}
          categories={history.map((h) => h.label)}
          series={[
            { name: "Revenue", color: REVENUE, values: history.map((h) => h.revenue) },
            { name: "Gross profit", color: PROFIT, values: history.map((h) => h.grossProfit) },
          ]}
          axisFormat={moneyAxis}
          tip={(c, s) => {
            const h = history[c];
            return `${h.label}${h.live ? " (so far)" : ""}\n${s === 0 ? "Revenue" : "Gross profit"}: £${money(s === 0 ? h.revenue : h.grossProfit)}`;
          }}
        />
      )}
    </ChartFrame>
  );
}

// TIME — hours per week of the month, split by the top 4 tasks + the rest.
export function HoursByWeekChart({ sessions, month }: { sessions: WorkSession[]; month: Date }) {
  const lastDay = endOfMonth(month).getDate();
  const today = new Date().getDate();
  const weeks = [1, 8, 15, 22, 29]
    .filter((start) => start <= Math.min(today, lastDay))
    .map((start) => ({ start, end: Math.min(start + 6, lastDay) }));
  const top = hoursByTask(sessions).slice(0, 4).map((t) => t.task);
  const groups = [...top, "Other tasks"];

  const hoursIn = (group: string, w: { start: number; end: number }) =>
    sessions
      .filter((s) => {
        const d = new Date(s.started_at).getDate();
        const inGroup = group === "Other tasks" ? !top.includes(s.task) : s.task === group;
        return inGroup && d >= w.start && d <= w.end;
      })
      .reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;

  const series = groups
    .map((g) => ({ name: g, color: g === "Other tasks" ? OTHER : taskColor(g), values: weeks.map((w) => hoursIn(g, w)) }))
    .filter((s) => s.values.some((v) => v > 0));
  const mon = format(month, "MMM");

  return (
    <ChartFrame
      title="Hours per week, by task"
      sub={series.some((s) => s.name === "Other tasks") ? "Top 4 tasks shown, the rest grouped" : undefined}
      legend={series.map((s) => ({ label: s.name, color: s.color as string }))}
      empty={sessions.length === 0 ? "No hours logged this month." : undefined}
    >
      {(width) => (
        <ColumnChart
          width={width}
          stacked
          categories={weeks.map((w) => (w.start === w.end ? `${w.start} ${mon}` : `${w.start}–${w.end} ${mon}`))}
          series={series}
          axisFormat={(v) => `${v}h`}
          tip={(c, s) => {
            const weekTotal = series.reduce((acc, x) => acc + x.values[c], 0);
            return `${weeks[c].start}–${weeks[c].end} ${mon}\n${series[s].name}: ${series[s].values[c].toFixed(1)}h\nWeek total: ${weekTotal.toFixed(1)}h`;
          }}
        />
      )}
    </ChartFrame>
  );
}

const BANDS = [
  { label: "Loss", test: (p: number) => p < 0, color: "#e66767" },
  { label: "£0–10", test: (p: number) => p >= 0 && p < 10, color: "#3987e5" },
  { label: "£10–20", test: (p: number) => p >= 10 && p < 20, color: "#d95926" },
  { label: "£20–30", test: (p: number) => p >= 20 && p < 30, color: "#199e70" },
  { label: "£30–40", test: (p: number) => p >= 30 && p < 40, color: "#c98500" },
  { label: "£40–60", test: (p: number) => p >= 40 && p < 60, color: "#d55181" },
  { label: "£60+", test: (p: number) => p >= 60, color: "#9085e9" },
];

// UNIT ECONOMICS — how many of this month's sales landed in each profit band.
export function ProfitBandsChart({ sales }: { sales: { profit: number }[] }) {
  const counts = BANDS.map((b) => sales.filter((s) => b.test(s.profit)).length);
  return (
    <ChartFrame
      title="This month's sales by profit per item"
      sub={`${sales.length} item${sales.length === 1 ? "" : "s"} sold`}
      empty={sales.length === 0 ? "No sales yet this month." : undefined}
    >
      {(width) => (
        <ColumnChart
          width={width}
          categories={BANDS.map((b) => b.label)}
          series={[{ name: "Items", color: BANDS.map((b) => b.color), values: counts }]}
          axisFormat={(v) => String(v)}
          tip={(c) => `${BANDS[c].label} profit\n${counts[c]} item${counts[c] === 1 ? "" : "s"}`}
        />
      )}
    </ChartFrame>
  );
}

// INVENTORY — money tied up in stock vs what it should bring in.
export function StockChart({ itemsInStock, inventoryCost, expectedRevenue, expectedProfit }: {
  itemsInStock: number; inventoryCost: number; expectedRevenue: number | null; expectedProfit: number | null;
}) {
  const rows = [
    { label: "Inventory cost", value: inventoryCost, color: PROFIT },
    ...(expectedRevenue !== null ? [{ label: "Expected revenue", value: expectedRevenue, color: REVENUE }] : []),
    ...(expectedProfit !== null ? [{ label: "Expected profit", value: expectedProfit, color: "#199e70" }] : []),
  ];
  return (
    <ChartFrame
      title="Money in stock right now"
      sub={`${itemsInStock} item${itemsInStock === 1 ? "" : "s"}`}
      empty={itemsInStock === 0 ? "No stock right now." : undefined}
    >
      {(width) => (
        <HorizontalBars width={width} rows={rows} format={(v) => `£${Math.round(v).toLocaleString("en-GB")}`} />
      )}
    </ChartFrame>
  );
}
