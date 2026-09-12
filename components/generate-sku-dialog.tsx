"use client";

import React, { useState } from "react";
import { X, Loader2, Check, AlertTriangle } from "lucide-react";
import { SKU_CATEGORIES } from "@/lib/sku-categories";

interface SkuResult {
  sku: string;
  sheetTab: string | null;
  sheetError: string | null;
}

interface GenerateSkuDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateSkuDialog({ isOpen, onClose }: GenerateSkuDialogProps) {
  const [category, setCategory] = useState(SKU_CATEGORIES[0].name);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkuResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sku/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to generate SKU.");
      else setResult(data);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm overflow-visible shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Generate SKU</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none"
            >
              {SKU_CATEGORIES.map((c) => (
                <option key={c.code} value={c.name} className="bg-zinc-900">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading ? "Generating" : "Generate SKU"}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
              <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-semibold">Generated SKU</span>
              <span className="text-3xl font-mono text-white tracking-wider">{result.sku}</span>
              {result.sheetTab && !result.sheetError && (
                <span className="text-[10px] text-white/40 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Added to {result.sheetTab}
                </span>
              )}
              {result.sheetError && (
                <span className="text-[10px] text-amber-400/80 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Couldn&rsquo;t reach the sheet — add it manually
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
