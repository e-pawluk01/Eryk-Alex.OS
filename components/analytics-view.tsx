"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard, MetricComparison } from "./metric-card";
import { MetricSection } from "./metric-section";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, endOfDay, subMonths, addDays, format } from "date-fns";
import { PastMonthsDialog } from "./past-months-dialog";
import { HistoricalSnapshotView } from "./historical-snapshot-view";
import { SessionsPanel } from "./sessions-panel";
import { SessionFormDialog } from "./session-form-dialog";
import { useGlobalContext } from "./global-context";
import { WorkSession, SESSIONS_CHANGED_EVENT } from "@/lib/work-sessions";

// This month's finished sessions, newest first.
async function fetchMonthSessions(date: Date): Promise<WorkSession[]> {
  const { data, error } = await supabase
    .from("work_sessions")
    .select("id, person, task, started_at, ended_at, duration")
    .gte("started_at", startOfMonth(date).toISOString())
    .lte("started_at", endOfMonth(date).toISOString())
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });
  if (error || !data) return [];
  return data as WorkSession[];
}

// Hours logged between two moments (finished sessions only).
async function fetchHoursBetween(from: Date, to: Date): Promise<number> {
  const { data, error } = await supabase
    .from("work_sessions")
    .select("duration")
    .gte("started_at", from.toISOString())
    .lte("started_at", to.toISOString())
    .not("ended_at", "is", null);
  if (error || !data) return 0;
  return data.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;
}

// When clocking in first started, across everyone.
async function fetchFirstSessionAt(): Promise<string | null> {
  const { data } = await supabase
    .from("work_sessions")
    .select("started_at")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.started_at ?? null;
}

// Arrows compare this month so far with the same days of last month, e.g.
// 1–23 Oct vs 1–23 Sep. subMonths clamps, so 31 Mar compares with 1–28 Feb.
function comparisonWindow(now: Date) {
  const cutoff = subMonths(now, 1);
  cutoff.setHours(12, 0, 0, 0);
  return {
    cutoff,
    start: startOfMonth(cutoff),
    end: endOfDay(cutoff),
    soldBy: format(cutoff, "yyyy-MM-dd"),
    label: cutoff.getDate() === 1
      ? `vs ${format(cutoff, "MMM")} 1`
      : `vs ${format(cutoff, "MMM")} 1–${format(cutoff, "d")}`,
  };
}

type SessionDialog = { mode: "edit"; session: WorkSession } | { mode: "add" } | null;
type Tone = "more-is-good" | "neutral";

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);
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

  const totalHours = sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;

  if (selectedHistorical) {
    return <HistoricalSnapshotView snapshot={selectedHistorical} onBack={() => setSelectedHistorical(null)} />;
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val: number) => {
    return val.toFixed(1);
  };

  const safeData = data || {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMargin: 0,
    itemsSold: 0,
    avgSalePrice: 0,
    avgProfitPerItem: 0,
    monthLabel: "Current Month",
    sellingCosts: 0,
    inventoryCost: 0,
    itemsInStock: 0,
    returnOnCost: null,
    expectedRevenue: null,
    expectedProfit: null,
    avgExpectedSalePrice: null,
  };

  const profitPerHour = totalHours > 0 ? safeData.grossProfit / totalHours : 0;

  // An arrow only shows once the data behind it covers all of last month:
  // - sales: every sale last month has a Sold date (column N)
  // - hours: clocking in had started by the 3rd of last month
  const span = comparisonWindow(new Date());
  const salesComparable = !!prevSales?.soldDatesComplete;
  const hoursComparable = !!firstSessionAt && new Date(firstSessionAt) < addDays(span.start, 3);
  const prevProfitPerHour = prevHours > 0 && prevSales ? prevSales.grossProfit / prevHours : null;

  const getComparison = (
    current: number,
    previous: number | null | undefined,
    tone: Tone,
    comparable: boolean
  ): MetricComparison | null => {
    if (!comparable || previous === undefined || previous === null || previous === 0) return null;
    const diff = current - previous;
    const up = diff >= 0;
    return {
      percentage: Math.abs((diff / previous) * 100),
      direction: up ? "up" : "down",
      // Costs and hours rising isn't good or bad on its own (more stock, more
      // sales, more work), so those arrows stay grey.
      tone: tone === "neutral" ? "neutral" : up ? "good" : "bad",
      label: span.label,
    };
  };
  const salesComparison = (current: number, previous: number | undefined, tone: Tone = "more-is-good") =>
    getComparison(current, previous, tone, salesComparable);

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
        <MetricSection title="Performance" loading={loading}>
          <MetricCard title="Revenue" value={formatCurrency(safeData.revenue)} prefix="£"
            comparison={salesComparison(safeData.revenue, prevSales?.revenue)} />
          <MetricCard title="COGS" value={formatCurrency(safeData.cogs)} prefix="£"
            comparison={salesComparison(safeData.cogs, prevSales?.cogs, "neutral")} />
          <MetricCard title="Selling Costs" value={formatCurrency(safeData.sellingCosts ?? 0)} prefix="£"
            comparison={salesComparison(safeData.sellingCosts ?? 0, prevSales?.sellingCosts, "neutral")} />
          <MetricCard title="Gross Profit" value={formatCurrency(safeData.grossProfit)} prefix="£"
            comparison={salesComparison(safeData.grossProfit, prevSales?.grossProfit)} />
          <MetricCard title="Gross Margin" value={formatPercent(safeData.grossMargin)} suffix="%"
            comparison={salesComparison(safeData.grossMargin, prevSales?.grossMargin)} />
          <MetricCard title="Profit / Hour" value={formatCurrency(profitPerHour)} prefix="£"
            comparison={getComparison(profitPerHour, prevProfitPerHour, "more-is-good", salesComparable && hoursComparable)} />
        </MetricSection>

        {/* TIME — where the hours go */}
        <MetricSection
          title="Time"
          loading={loading}
          detail={hoursOpen ? (
            <SessionsPanel
              sessions={sessions}
              onEdit={(session) => setSessionDialog({ mode: "edit", session })}
              onAdd={() => setSessionDialog({ mode: "add" })}
            />
          ) : null}
        >
          <MetricCard title="Total Hours" value={totalHours.toFixed(1)} suffix="h"
            comparison={getComparison(totalHours, prevHours, "neutral", hoursComparable)}
            onClick={() => setHoursOpen(!hoursOpen)} expanded={hoursOpen} />
        </MetricSection>

        {/* UNIT ECONOMICS — quality of each sale */}
        <MetricSection title="Unit Economics" loading={loading}>
          <MetricCard title="Items Sold" value={safeData.itemsSold}
            comparison={salesComparison(safeData.itemsSold, prevSales?.itemsSold)} />
          <MetricCard title="Avg Sale Price" value={formatCurrency(safeData.avgSalePrice)} prefix="£"
            comparison={salesComparison(safeData.avgSalePrice, prevSales?.avgSalePrice)} />
          <MetricCard title="Avg Profit/Item" value={formatCurrency(safeData.avgProfitPerItem)} prefix="£"
            comparison={salesComparison(safeData.avgProfitPerItem, prevSales?.avgProfitPerItem)} />
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
