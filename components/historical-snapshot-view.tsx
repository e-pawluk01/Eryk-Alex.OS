"use client";

import React from "react";
import { MetricCard } from "./metric-card";
import { ArrowLeft, Lock } from "lucide-react";

interface HistoricalSnapshotViewProps {
  snapshot: any;
  onBack: () => void;
}

export function HistoricalSnapshotView({ snapshot, onBack }: HistoricalSnapshotViewProps) {
  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val: number) => {
    return Number(val || 0).toFixed(1);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-sm uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
              {snapshot.month_label} History
              <Lock className="w-3 h-3 text-white/30" />
            </h2>
            <span className="text-[9px] uppercase tracking-widest text-white/40">Read Only Snapshot</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-90">
        <MetricCard 
          title="Revenue" 
          value={formatCurrency(snapshot.revenue)} 
          prefix="£" 
        />
        <MetricCard 
          title="Gross Profit" 
          value={formatCurrency(snapshot.gross_profit)} 
          prefix="£" 
        />
        <MetricCard
          title="COGS"
          value={formatCurrency(snapshot.cogs)}
          prefix="£"
        />
        <MetricCard
          title="Selling Costs"
          value={formatCurrency(snapshot.selling_costs)}
          prefix="£"
        />
        <MetricCard
          title="Gross Margin"
          value={formatPercent(snapshot.gross_margin)} 
          suffix="%" 
        />
        
        <MetricCard 
          title="Items Sold" 
          value={snapshot.items_sold || 0} 
        />
        <MetricCard 
          title="Avg Sale Price" 
          value={formatCurrency(snapshot.average_sale_price)} 
          prefix="£" 
        />
        <MetricCard 
          title="Avg Profit/Item" 
          value={formatCurrency(snapshot.average_profit_per_item)} 
          prefix="£" 
        />
        <MetricCard 
          title="Profit / Hour" 
          value={formatCurrency(snapshot.profit_per_hour)} 
          prefix="£" 
        />
      </div>
      
      <div className="mt-12 flex justify-center border border-dashed border-white/5 rounded-lg py-8 text-center bg-white/5 text-white/30">
        <p className="text-[10px] uppercase tracking-widest">Historical snapshots cannot be altered</p>
      </div>
    </div>
  );
}
