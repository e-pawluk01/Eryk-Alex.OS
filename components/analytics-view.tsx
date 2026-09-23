"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard, MetricComparison } from "./metric-card";
import { MetricSection } from "./metric-section";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fetchFirstSessionAt, profitPerHourFor } from "@/lib/hours-coverage";
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

type SessionDialog = { mode: "edit"; session: WorkSession } | { mode: "add" } | null;

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [sessionDialog, setSessionDialog] = useState<SessionDialog>(null);
  const { userEmail } = useGlobalContext();
  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";
  const [prevSnapshot, setPrevSnapshot] = useState<any>(null);
  const [snapshotCount, setSnapshotCount] = useState<number>(0);
  const [firstSessionAt, setFirstSessionAt] = useState<string | null>(null);

  const [selectedHistorical, setSelectedHistorical] = useState<any>(null);

  const fetchLiveAndPreviousData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const prevDate = subMonths(now, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;

      // 1. Fetch live current month, last month's snapshot, and how many
      //    closed snapshots exist in total (drives whether arrows show).
      const [sheetsResult, sessionsResult, prevSnapshotResult, snapshotCountResult, firstSessionResult] = await Promise.all([
        getMonthlyAnalytics(),
        fetchMonthSessions(now),
        supabase.from("analytics_monthly_snapshots").select("*").eq("month", prevMonthKey).maybeSingle(),
        supabase.from("analytics_monthly_snapshots").select("id", { count: "exact", head: true }),
        fetchFirstSessionAt(supabase),
      ]);

      if (sheetsResult.error) {
        setError(sheetsResult.error);
      } else {
        setData(sheetsResult.data);
      }

      setSessions(sessionsResult);
      setPrevSnapshot(prevSnapshotResult?.data || null);
      setSnapshotCount(snapshotCountResult?.count || 0);
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

  // Null until a month has been clocked from the start (see hours-coverage).
  const profitPerHour = profitPerHourFor(new Date(), safeData.grossProfit, totalHours, firstSessionAt);

  // Arrows stay hidden until there are at least 3 closed monthly snapshots —
  // comparing one thin month against another is noise, not signal.
  const showArrows = snapshotCount >= 3 && !!prevSnapshot;

  const getComparison = (current: number, previous: number | undefined): MetricComparison | null => {
    if (previous === undefined || previous === null || previous === 0) return null;
    const diff = current - previous;
    const percentage = (diff / previous) * 100;
    return {
      percentage: Math.abs(percentage),
      isPositive: diff >= 0,
      label: `vs ${prevSnapshot.month_label}`,
    };
  };

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
            comparison={showArrows ? getComparison(safeData.revenue, prevSnapshot.revenue) : null} />
          <MetricCard title="COGS" value={formatCurrency(safeData.cogs)} prefix="£"
            comparison={showArrows ? getComparison(safeData.cogs, prevSnapshot.cogs) : null} />
          <MetricCard title="Selling Costs" value={formatCurrency(safeData.sellingCosts ?? 0)} prefix="£"
            comparison={showArrows ? getComparison(safeData.sellingCosts ?? 0, prevSnapshot.selling_costs) : null} />
          <MetricCard title="Gross Profit" value={formatCurrency(safeData.grossProfit)} prefix="£"
            comparison={showArrows ? getComparison(safeData.grossProfit, prevSnapshot.gross_profit) : null} />
          <MetricCard title="Gross Margin" value={formatPercent(safeData.grossMargin)} suffix="%"
            comparison={showArrows ? getComparison(safeData.grossMargin, prevSnapshot.gross_margin) : null} />
          <MetricCard title="Profit / Hour"
            value={profitPerHour !== null ? formatCurrency(profitPerHour) : "—"}
            prefix={profitPerHour !== null ? "£" : undefined}
            comparison={showArrows && profitPerHour !== null ? getComparison(profitPerHour, prevSnapshot.profit_per_hour) : null} />
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
            onClick={() => setHoursOpen(!hoursOpen)} expanded={hoursOpen} />
        </MetricSection>

        {/* UNIT ECONOMICS — quality of each sale */}
        <MetricSection title="Unit Economics" loading={loading}>
          <MetricCard title="Items Sold" value={safeData.itemsSold}
            comparison={showArrows ? getComparison(safeData.itemsSold, prevSnapshot.items_sold) : null} />
          <MetricCard title="Avg Sale Price" value={formatCurrency(safeData.avgSalePrice)} prefix="£"
            comparison={showArrows ? getComparison(safeData.avgSalePrice, prevSnapshot.average_sale_price) : null} />
          <MetricCard title="Avg Profit/Item" value={formatCurrency(safeData.avgProfitPerItem)} prefix="£"
            comparison={showArrows ? getComparison(safeData.avgProfitPerItem, prevSnapshot.average_profit_per_item) : null} />
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
