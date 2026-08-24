"use client";

import React, { useEffect, useState } from "react";
import { X, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { MetricCard } from "./metric-card";

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyticsPanel({ isOpen, onClose }: AnalyticsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
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

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" 
          onClick={onClose}
        />
      )}

      {/* Slide-over Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-[420px] bg-[#09090b] z-50",
          "transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col border-l border-white/5",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-6 relative flex-shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2 mt-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide">Performance</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {data?.monthLabel ? `Data for ${data.monthLabel}` : "Current calendar month"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-24 flex flex-col gap-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs tracking-widest uppercase font-semibold">Loading data...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-400/80 bg-red-500/10 rounded-xl p-6 text-center border border-red-500/20">
              <AlertCircle className="w-8 h-8" />
              <span className="text-xs">{error}</span>
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard 
                title="Revenue" 
                value={formatCurrency(data.revenue)} 
                prefix="£" 
                className="col-span-2 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20"
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
          ) : null}
        </div>
      </div>
    </>
  );
}
