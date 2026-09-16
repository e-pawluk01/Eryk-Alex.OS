"use client";

import { useState } from "react";
import { Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { PhotoSlot } from "@/components/listing-photo-picker";

interface RegenerateTitlePanelProps {
  photos: PhotoSlot[];
  category: string;
  brand: string;
  size: string;
  measurements: string;
  notes: string;
}

interface Titles {
  depopTitle: string;
  vintedTitle: string;
}

// Deliberately separate from the main Generate Listing flow — no SKU spent,
// no Drive touched, just fresh titles to paste into an existing re-upload.
export function RegenerateTitlePanel({ photos, category, brand, size, measurements, notes }: RegenerateTitlePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Titles | null>(null);
  const [copied, setCopied] = useState<"depop" | "vinted" | null>(null);

  const regenerate = async () => {
    setIsLoading(true);
    setError(null);
    setTitles(null);
    try {
      const formData = new FormData();
      formData.set("category", category);
      formData.set("brand", brand);
      formData.set("size", size);
      formData.set("measurements", measurements);
      formData.set("notes", notes);
      photos.forEach((p) => formData.append("photos", p.file));

      const res = await fetch("/api/listings/regenerate-title", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to regenerate the title.");
      else setTitles(data);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const copy = (text: string, which: "depop" | "vinted") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 pt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Just need a new title? (for re-uploads)</span>
        <button
          onClick={regenerate}
          disabled={photos.length === 0 || isLoading}
          className="shrink-0 border border-white/10 text-white/60 text-[9.5px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg hover:text-white hover:border-white/30 transition-colors disabled:opacity-30 flex items-center gap-1.5"
        >
          {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          Regenerate Title
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {titles && (
        <div className="flex flex-col gap-2">
          {([["Depop", titles.depopTitle, "depop"], ["Vinted", titles.vintedTitle, "vinted"]] as const).map(
            ([label, text, key]) => (
              <div key={key} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                <span className="text-[9px] uppercase tracking-widest text-white/30 shrink-0">{label}</span>
                <span className="text-xs text-white/80 flex-1">{text}</span>
                <button
                  onClick={() => copy(text, key)}
                  className="shrink-0 text-white/40 hover:text-white transition-colors"
                >
                  {copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
