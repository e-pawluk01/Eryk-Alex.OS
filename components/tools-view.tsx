"use client";

import React, { useState } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { SKU_CATEGORIES } from "@/lib/sku-categories";

interface SkuResult {
  sku: string;
  sheetTab: string | null;
  sheetError: string | null;
}

export function ToolsView() {
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Tools</h2>
      </div>

      <div className="max-w-md w-full bg-[#111] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">SKU Generator</span>

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
  );
}
