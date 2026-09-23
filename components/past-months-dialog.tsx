"use client";

import React, { useEffect, useState } from "react";
import { X, History, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PastMonthsDialogProps {
  onOpenSnapshot: (snapshot: any) => void;
  trigger?: React.ReactNode;
}

export function PastMonthsDialog({ onOpenSnapshot, trigger }: PastMonthsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [goalsByMonth, setGoalsByMonth] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen]);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const [snapshotsResult, goalsResult] = await Promise.all([
        supabase.from("analytics_monthly_snapshots").select("*").order("month", { ascending: false }),
        supabase.from("monthly_goals").select("month, gross_profit_goal"),
      ]);

      if (snapshotsResult.error) throw snapshotsResult.error;
      setSnapshots(snapshotsResult.data || []);

      const goalMap: Record<string, number> = {};
      (goalsResult.data || []).forEach((g: any) => { goalMap[g.month] = g.gross_profit_goal; });
      setGoalsByMonth(goalMap);
    } catch (err) {
      console.error("Failed to fetch past months", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return `£${val.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
            <History className="w-3 h-3" />
            Past Months
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[95%] max-w-2xl shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Historical Snapshots</span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-xs font-semibold uppercase tracking-widest">
                  No historical snapshots saved yet.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-white/30">
                        <th className="pb-3 font-semibold">Month</th>
                        <th className="pb-3 font-semibold">Goal</th>
                        <th className="pb-3 font-semibold">Revenue</th>
                        <th className="pb-3 font-semibold">Profit</th>
                        <th className="pb-3 font-semibold">Margin</th>
                        <th className="pb-3 font-semibold">Sold</th>
                        <th className="pb-3 font-semibold">Profit/Hr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((s) => (
                        <tr 
                          key={s.id} 
                          onClick={() => {
                            setIsOpen(false);
                            onOpenSnapshot(s);
                          }}
                          className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                        >
                          <td className="py-4 text-xs font-bold text-white/80 group-hover:text-white">{s.month_label}</td>
                          <td className="py-4 text-xs font-semibold text-white/60">
                            {goalsByMonth[s.month] !== undefined ? formatCurrency(goalsByMonth[s.month]) : "—"}
                          </td>
                          <td className="py-4 text-xs font-semibold text-white/60">{formatCurrency(s.revenue)}</td>
                          <td className="py-4 text-xs font-semibold text-emerald-400/80">{formatCurrency(s.gross_profit)}</td>
                          <td className="py-4 text-xs font-semibold text-white/60">{Number(s.gross_margin).toFixed(1)}%</td>
                          <td className="py-4 text-xs font-semibold text-white/60">{s.items_sold}</td>
                          <td className="py-4 text-xs font-semibold text-white/60">{formatCurrency(s.profit_per_hour)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
