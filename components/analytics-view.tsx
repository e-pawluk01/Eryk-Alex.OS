"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard } from "./metric-card";

export function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const result = await getMonthlyAnalytics();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

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
    monthLabel: "Current Month"
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 relative">
      <div className="flex items-center justify-between border-b border-border pb-2">
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
      </div>

      <div className="mt-12 flex justify-center border border-dashed border-border rounded-lg py-8 text-center bg-card/20 text-muted-foreground/50">
        <p className="text-[10px] uppercase tracking-widest">(The rest will be updated in the next phase)</p>
      </div>
    </div>
  );
}
