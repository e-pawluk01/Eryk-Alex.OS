"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SetGoalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string; // "yyyy-MM"
  monthLabel: string;
  currentGoal: number | null;
  onSaved: (newGoal: number) => void;
}

export function SetGoalDialog({ isOpen, onClose, monthKey, monthLabel, currentGoal, onSaved }: SetGoalDialogProps) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentGoal !== null ? String(currentGoal) : "");
      setError(null);
    }
  }, [isOpen, currentGoal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("Enter an amount greater than £0.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: upsertError } = await supabase
        .from("monthly_goals")
        .upsert({ month: monthKey, gross_profit_goal: value }, { onConflict: "month" });

      if (upsertError) throw upsertError;
      onSaved(value);
    } catch (err: any) {
      setError(err.message || "Failed to save the goal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Gross Profit Goal — {monthLabel}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
              Target gross profit
            </label>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-white/30 transition-colors">
              <span className="text-white/40 text-sm">£</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
                autoFocus
                placeholder="600"
                className="w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/20"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? "Saving..." : currentGoal !== null ? "Update Goal" : "Set Goal"}
          </button>
        </form>
      </div>
    </div>
  );
}
