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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs tracking-widest uppercase font-semibold">Loading Analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-red-400/80 bg-red-500/10 rounded-xl p-6 text-center border border-red-500/20 max-w-lg mx-auto">
        <AlertCircle className="w-8 h-8" />
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {data.monthLabel} Data
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Revenue" 
          value={formatCurrency(data.revenue)} 
          prefix="£" 
        />
        <MetricCard 
          title="Gross Profit" 
          value={formatCurrency(data.grossProfit)} 
          prefix="£" 
        />
        <MetricCard 
          title="COGS" 
          value={formatCurrency(data.cogs)} 
          prefix="£" 
        />
        <MetricCard 
          title="Gross Margin" 
          value={formatPercent(data.grossMargin)} 
          suffix="%" 
        />
        
        <MetricCard 
          title="Items Sold" 
          value={data.itemsSold} 
        />
        <MetricCard 
          title="Avg Sale Price" 
          value={formatCurrency(data.avgSalePrice)} 
          prefix="£" 
        />
        <MetricCard 
          title="Avg Profit/Item" 
          value={formatCurrency(data.avgProfitPerItem)} 
          prefix="£" 
        />
      </div>

      <div className="mt-12 flex justify-center border border-dashed border-border rounded-lg py-8 text-center bg-card/20 text-muted-foreground/50">
        <p className="text-[10px] uppercase tracking-widest">(The rest will be updated in the next phase)</p>
      </div>
    </div>
  );
}
