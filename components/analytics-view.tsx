"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard } from "./metric-card";
import { MetricSection } from "./metric-section";
import { PastMonthsDialog } from "./past-months-dialog";
import { HistoricalSnapshotView } from "./historical-snapshot-view";
import { SessionsPanel } from "./sessions-panel";
import { SessionFormDialog } from "./session-form-dialog";
import { RevenueBreakdownPanel, TaskBreakdownPanel, SalesTablePanel } from "./analytics-details";
import { useGlobalContext } from "./global-context";
import { WorkSession, SESSIONS_CHANGED_EVENT, formatMinutes } from "@/lib/work-sessions";
import {
  fetchMonthSessions, fetchHoursBetween, fetchFirstSessionAt, comparisonWindow,
  hoursCoverLastMonth, makeComparison, hoursByTask, Tone,
} from "@/lib/analytics-data";

type SessionDialog = { mode: "edit"; session: WorkSession } | { mode: "add" } | null;
type OpenCard = "revenue" | "hours" | "tasks" | "sales" | null;

const EMPTY_DATA = {
  revenue: 0, cogs: 0, sellingCosts: 0, sellingFees: 0, shippingCosts: 0,
  grossProfit: 0, grossMargin: 0, itemsSold: 0, avgSalePrice: 0, avgProfitPerItem: 0,
  monthLabel: "Current Month", salesTable: [],
  inventoryCost: 0, itemsInStock: 0, returnOnCost: null,
  expectedRevenue: null, expectedProfit: null, avgExpectedSalePrice: null,
};

const formatCurrency = (val: number) => val.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercent = (val: number) => val.toFixed(1);

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const [sessionDialog, setSessionDialog] = useState<SessionDialog>(null);
  const { userEmail } = useGlobalContext();
  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";
  // Last month, cut off at the same day of the month as today.
  const [prevSales, setPrevSales] = useState<any>(null);
  const [prevHours, setPrevHours] = useState<number>(0);
  const [firstSessionAt, setFirstSessionAt] = useState<string | null>(null);

  const [selectedHistorical, setSelectedHistorical] = useState<any>(null);

  const fetchLiveAndPreviousData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const span = comparisonWindow(now);

      // This month live, plus the same stretch of last month for the arrows.
      const [sheetsResult, sessionsResult, prevSalesResult, prevHoursResult, firstSessionResult] = await Promise.all([
        getMonthlyAnalytics(),
        fetchMonthSessions(now),
        getMonthlyAnalytics(span.cutoff.toISOString(), span.soldBy),
        fetchHoursBetween(span.start, span.end),
        fetchFirstSessionAt(),
      ]);

      if (sheetsResult.error) {
        setError(sheetsResult.error);
      } else {
        setData(sheetsResult.data);
      }

      setSessions(sessionsResult);
      setPrevSales(prevSalesResult.error ? null : prevSalesResult.data);
      setPrevHours(prevHoursResult);
      setFirstSessionAt(firstSessionResult);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveAndPreviousData();
  }, [fetchLiveAndPreviousData]);

  // Clocking out, editing or adding a session anywhere refreshes the hours.
  useEffect(() => {
    const refresh = () => { fetchMonthSessions(new Date()).then(setSessions); };
    window.addEventListener(SESSIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSIONS_CHANGED_EVENT, refresh);
  }, []);

  if (selectedHistorical) {
    return <HistoricalSnapshotView snapshot={selectedHistorical} onBack={() => setSelectedHistorical(null)} />;
  }

  const safeData = data || EMPTY_DATA;
  const now = new Date();
  const span = comparisonWindow(now);

  // --- Hours ---------------------------------------------------------------
  const totalHours = sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;
  const profitPerHour = totalHours > 0 ? safeData.grossProfit / totalHours : 0;
  const hoursPerWeek = totalHours / (now.getDate() / 7);
  const minutesPerItem = safeData.itemsSold > 0 && totalHours > 0 ? (totalHours * 60) / safeData.itemsSold : null;
  const tasks = hoursByTask(sessions);
  const topTask = tasks[0] ?? null;

  // --- Arrows --------------------------------------------------------------
  // An arrow only shows once the data behind it covers all of last month:
  // sales need every sale last month to have a Sold date (column N); hours
  // need clocking to have started by the 3rd of last month.
  const salesComparable = !!prevSales?.soldDatesComplete;
  const hoursComparable = hoursCoverLastMonth(firstSessionAt, span.start);
  const bothComparable = salesComparable && hoursComparable;
  const prevItems = prevSales?.itemsSold ?? 0;

  const compare = (current: number, previous: number | null | undefined, tone: Tone, comparable: boolean) =>
    makeComparison(current, previous, tone, comparable, span.label);
  const sales = (current: number, previous: number | undefined) =>
    compare(current, previous, "more-is-good", salesComparable);

  const toggle = (card: Exclude<OpenCard, null>) => setOpenCard(openCard === card ? null : card);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          {safeData.monthLabel} Live
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
        </h2>

        <PastMonthsDialog onOpenSnapshot={setSelectedHistorical} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3 border border-red-500/20 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col">
        {/* PERFORMANCE — money from sales this month */}
        <MetricSection
          title="Performance"
          loading={loading}
          detail={openCard === "revenue" ? <RevenueBreakdownPanel data={safeData} /> : null}
        >
          <MetricCard title="Revenue" value={formatCurrency(safeData.revenue)} prefix="£"
            comparison={sales(safeData.revenue, prevSales?.revenue)}
            onClick={() => toggle("revenue")} expanded={openCard === "revenue"} />
          <MetricCard title="Gross Profit" value={formatCurrency(safeData.grossProfit)} prefix="£"
            comparison={sales(safeData.grossProfit, prevSales?.grossProfit)} />
          <MetricCard title="Gross Margin" value={formatPercent(safeData.grossMargin)} suffix="%"
            comparison={sales(safeData.grossMargin, prevSales?.grossMargin)} />
          <MetricCard title="Profit / Hour" value={formatCurrency(profitPerHour)} prefix="£"
            comparison={compare(profitPerHour, prevHours > 0 && prevSales ? prevSales.grossProfit / prevHours : null, "more-is-good", bothComparable)} />
        </MetricSection>

        {/* TIME — where the hours go */}
        <MetricSection
          title="Time"
          loading={loading}
          detail={
            openCard === "hours" ? (
              <SessionsPanel
                sessions={sessions}
                onEdit={(session) => setSessionDialog({ mode: "edit", session })}
                onAdd={() => setSessionDialog({ mode: "add" })}
              />
            ) : openCard === "tasks" ? <TaskBreakdownPanel tasks={tasks} /> : null
          }
        >
          <MetricCard title="Total Hours" value={totalHours.toFixed(1)} suffix="h"
            comparison={compare(totalHours, prevHours, "neutral", hoursComparable)}
            onClick={() => toggle("hours")} expanded={openCard === "hours"} />
          <MetricCard title="Hours / Week" value={hoursPerWeek.toFixed(1)} suffix="h"
            comparison={compare(hoursPerWeek, prevHours / (span.cutoff.getDate() / 7), "neutral", hoursComparable)} />
          <MetricCard title="Hours / Item Sold" compact
            value={minutesPerItem !== null ? formatMinutes(Math.round(minutesPerItem)) : "—"}
            comparison={minutesPerItem !== null
              ? compare(minutesPerItem, prevItems > 0 && prevHours > 0 ? (prevHours * 60) / prevItems : null, "neutral", bothComparable)
              : null} />
          <MetricCard title="Top Task" compact
            value={topTask ? topTask.task : "—"}
            sub={topTask ? `${topTask.hours.toFixed(1)}h · ${Math.round((topTask.hours / totalHours) * 100)}% of time` : undefined}
            onClick={topTask ? () => toggle("tasks") : undefined} expanded={openCard === "tasks"} />
        </MetricSection>

        {/* UNIT ECONOMICS — quality of each sale */}
        <MetricSection
          title="Unit Economics"
          loading={loading}
          detail={openCard === "sales" ? <SalesTablePanel sales={safeData.salesTable || []} /> : null}
        >
          <MetricCard title="Items Sold" value={safeData.itemsSold}
            comparison={sales(safeData.itemsSold, prevSales?.itemsSold)}
            onClick={() => toggle("sales")} expanded={openCard === "sales"} />
          <MetricCard title="Avg Sale Price" value={formatCurrency(safeData.avgSalePrice)} prefix="£"
            comparison={sales(safeData.avgSalePrice, prevSales?.avgSalePrice)} />
          <MetricCard title="Avg Profit/Item" value={formatCurrency(safeData.avgProfitPerItem)} prefix="£"
            comparison={sales(safeData.avgProfitPerItem, prevSales?.avgProfitPerItem)} />
          <MetricCard title="Return on Cost"
            value={safeData.returnOnCost !== null ? formatPercent(safeData.returnOnCost) : "—"}
            suffix={safeData.returnOnCost !== null ? "%" : undefined} />
        </MetricSection>

        {/* INVENTORY — money tied up in unsold stock, as of now */}
        <MetricSection title="Inventory" loading={loading}>
          <MetricCard title="Items in Stock" value={safeData.itemsInStock ?? 0} />
          <MetricCard title="Inventory Cost" value={formatCurrency(safeData.inventoryCost ?? 0)} prefix="£" />
          <MetricCard title="Expected Revenue"
            value={safeData.expectedRevenue !== null ? formatCurrency(safeData.expectedRevenue) : "—"}
            prefix={safeData.expectedRevenue !== null ? "£" : undefined} />
          <MetricCard title="Expected Profit"
            value={safeData.expectedProfit !== null ? formatCurrency(safeData.expectedProfit) : "—"}
            prefix={safeData.expectedProfit !== null ? "£" : undefined} />
        </MetricSection>
      </div>

      {sessionDialog && (
        <SessionFormDialog
          mode={sessionDialog.mode}
          session={sessionDialog.mode === "edit" ? sessionDialog.session : undefined}
          person={userContextName}
          onClose={() => setSessionDialog(null)}
          onSaved={() => setSessionDialog(null)}
        />
      )}
    </div>
  );
}
