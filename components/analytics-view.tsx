"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard } from "./metric-card";
import { ActiveSessionWidget } from "./active-session-widget";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth } from "date-fns";

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [totalHours, setTotalHours] = useState<number>(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sheetsResult, sessionsResult] = await Promise.all([
        getMonthlyAnalytics(),
        fetchCurrentMonthHours()
      ]);

      if (sheetsResult.error) {
        setError(sheetsResult.error);
      } else {
        setData(sheetsResult.data);
      }

      setTotalHours(sessionsResult);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCurrentMonthHours = async (): Promise<number> => {
    const start = startOfMonth(new Date()).toISOString();
    const end = endOfMonth(new Date()).toISOString();

    const { data: sessions, error } = await supabase
      .from("work_sessions")
      .select("duration")
      .gte("started_at", start)
      .lte("started_at", end)
      .not("ended_at", "is", null);

    if (error) {
      console.error("Error fetching work sessions", error);
      return 0;
    }

    if (!sessions) return 0;

    const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    return totalSeconds / 3600; // Return in hours
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val: number) => {
    return val.toFixed(1);
  };

  const formatHours = (val: number) => {
    return val.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const safeData = data || {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMargin: 0,
    itemsSold: 0,
    avgSalePrice: 0,
    avgProfitPerItem: 0,
    monthLabel: "Current Month"
  };

  const profitPerHour = totalHours > 0 ? safeData.grossProfit / totalHours : 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          {safeData.monthLabel} Data
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
        </h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3 border border-red-500/20 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
        <MetricCard 
          title="Revenue" 
          value={formatCurrency(safeData.revenue)} 
          prefix="£" 
        />
        <MetricCard 
          title="Gross Profit" 
          value={formatCurrency(safeData.grossProfit)} 
          prefix="£" 
        />
        <MetricCard 
          title="COGS" 
          value={formatCurrency(safeData.cogs)} 
          prefix="£" 
        />
        <MetricCard 
          title="Gross Margin" 
          value={formatPercent(safeData.grossMargin)} 
          suffix="%" 
        />
        
        <MetricCard 
          title="Items Sold" 
          value={safeData.itemsSold} 
        />
        <MetricCard 
          title="Avg Sale Price" 
          value={formatCurrency(safeData.avgSalePrice)} 
          prefix="£" 
        />
        <MetricCard 
          title="Avg Profit/Item" 
          value={formatCurrency(safeData.avgProfitPerItem)} 
          prefix="£" 
        />
        <MetricCard 
          title="Profit / Hour" 
          value={formatCurrency(profitPerHour)} 
          prefix="£" 
        />
      </div>

      <div className="mt-12 flex justify-center border border-dashed border-border rounded-lg py-8 text-center bg-card/20 text-muted-foreground/50">
        <p className="text-[10px] uppercase tracking-widest">(The rest will be updated in the next phase)</p>
      </div>
    </div>
  );
}
