"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard, MetricComparison } from "./metric-card";
import { MetricSection } from "./metric-section";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { PastMonthsDialog } from "./past-months-dialog";
import { HistoricalSnapshotView } from "./historical-snapshot-view";
import { SetGoalDialog } from "./set-goal-dialog";

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [prevSnapshot, setPrevSnapshot] = useState<any>(null);
  const [snapshotCount, setSnapshotCount] = useState<number>(0);
  const [goal, setGoal] = useState<any>(null);
  const [isGoalDialogOpen, setGoalDialogOpen] = useState(false);

  const [selectedHistorical, setSelectedHistorical] = useState<any>(null);

  const fetchLiveAndPreviousData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const prevDate = subMonths(now, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      // 1. Fetch live current month, last month's snapshot, how many closed
      //    snapshots exist (drives whether arrows show), and this month's goal.
      const [sheetsResult, sessionsResult, prevSnapshotResult, snapshotCountResult, goalResult] = await Promise.all([
        getMonthlyAnalytics(),
        fetchCurrentMonthHours(now),
        supabase.from("analytics_monthly_snapshots").select("*").eq("month", prevMonthKey).maybeSingle(),
        supabase.from("analytics_monthly_snapshots").select("id", { count: "exact", head: true }),
        supabase.from("monthly_goals").select("*").eq("month", currentMonthKey).maybeSingle(),
      ]);

      if (sheetsResult.error) {
        setError(sheetsResult.error);
      } else {
        setData(sheetsResult.data);
      }

      setTotalHours(sessionsResult);
      setPrevSnapshot(prevSnapshotResult?.data || null);
      setSnapshotCount(snapshotCountResult?.count || 0);
      setGoal(goalResult?.data || null);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveAndPreviousData();
  }, [fetchLiveAndPreviousData]);

  const fetchCurrentMonthHours = async (date: Date): Promise<number> => {
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();

    const { data: sessions, error } = await supabase
      .from("work_sessions")
      .select("duration")
      .gte("started_at", start)
      .lte("started_at", end)
      .not("ended_at", "is", null);

    if (error) return 0;
    if (!sessions) return 0;
    const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    return totalSeconds / 3600;
  };

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

  // GOAL — deterministic, not a forecast: what's needed vs. what's set.
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const daysLeft = Math.max(1, endOfMonth(today).getDate() - today.getDate() + 1);

  const goalAmount: number | null = goal?.gross_profit_goal ?? null;
  const progressPct = goalAmount ? (safeData.grossProfit / goalAmount) * 100 : null;
  const remaining = goalAmount !== null ? Math.max(0, goalAmount - safeData.grossProfit) : null;
  const estSalesRemaining =
    remaining === null ? null :
    remaining === 0 ? 0 :
    safeData.avgProfitPerItem > 0 ? Math.ceil(remaining / safeData.avgProfitPerItem) : null;
  const paceNeeded = remaining === null ? null : remaining === 0 ? 0 : remaining / daysLeft;

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
        {/* GOAL — where you're trying to get to this month */}
        <MetricSection title="Goal" loading={loading}>
          <button onClick={() => setGoalDialogOpen(true)} className="text-left">
            <MetricCard title="Gross Profit Goal"
              value={goalAmount !== null ? formatCurrency(goalAmount) : "Set Goal"}
              prefix={goalAmount !== null ? "£" : undefined} />
          </button>
          <MetricCard title="Progress"
            value={progressPct !== null ? formatPercent(progressPct) : "—"}
            suffix={progressPct !== null ? "%" : undefined} />
          <MetricCard title="Remaining"
            value={remaining === null ? "—" : remaining === 0 ? "Goal met" : formatCurrency(remaining)}
            prefix={remaining !== null && remaining > 0 ? "£" : undefined} />
          <MetricCard title="Est. Sales Remaining"
            value={estSalesRemaining === null ? "—" : String(estSalesRemaining)} />
          <MetricCard title="Pace Needed"
            value={remaining === null ? "—" : remaining === 0 ? "Goal met" : formatCurrency(paceNeeded as number)}
            prefix={remaining !== null && remaining > 0 ? "£" : undefined}
            suffix={remaining !== null && remaining > 0 ? "/day" : undefined} />
        </MetricSection>

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
          <MetricCard title="Profit / Hour" value={formatCurrency(profitPerHour)} prefix="£"
            comparison={showArrows ? getComparison(profitPerHour, prevSnapshot.profit_per_hour) : null} />
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

      <SetGoalDialog
        isOpen={isGoalDialogOpen}
        onClose={() => setGoalDialogOpen(false)}
        monthKey={currentMonthKey}
        monthLabel={safeData.monthLabel}
        currentGoal={goalAmount}
        onSaved={(newGoal) => {
          setGoal({ month: currentMonthKey, gross_profit_goal: newGoal });
          setGoalDialogOpen(false);
        }}
      />
    </div>
  );
}
