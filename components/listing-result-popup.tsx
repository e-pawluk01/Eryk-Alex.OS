"use client";

import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";

export type ListingResult =
  | { kind: "saved"; sku: string; vintedLink: string | null; depopLink: string | null }
  | { kind: "failed"; reason: string; sku: string | null };

interface ListingResultPopupProps {
  result: ListingResult | null;
  onClose: () => void;
}

// Portalled to <body> because the Listings slide-over is transformed, which
// would otherwise pin a `fixed` pop-up to the panel instead of the screen.
export function ListingResultPopup({ result, onClose }: ListingResultPopupProps) {
  if (!result) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4 p-6 flex flex-col items-center gap-3 text-center">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        {result.kind === "saved" ? (
          <>
            <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-semibold">Listing saved</span>
            <span className="text-3xl font-mono text-white tracking-wider">{result.sku}</span>
            <div className="w-full flex flex-col gap-2 mt-1">
              {[
                { label: "Vinted listing", href: result.vintedLink },
                { label: "Depop listing", href: result.depopLink },
              ]
                .filter((l) => l.href)
                .map((l) => (
                  <a
                    key={l.label}
                    href={l.href!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white hover:border-white/30 transition-colors"
                  >
                    <span>{l.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white/50" />
                  </a>
                ))}
            </div>
          </>
        ) : (
          <>
            <span className="text-[9px] uppercase tracking-widest text-red-400/80 font-semibold">Listing failed</span>
            <span className="text-[13px] text-white/80 leading-relaxed">{result.reason}</span>
            {result.sku && (
              <div className="w-full flex flex-col gap-1.5 bg-white/5 border border-white/10 rounded-lg p-3 mt-1">
                <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">SKU already used</span>
                <span className="text-xl font-mono text-white tracking-wider">{result.sku}</span>
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-all mt-2"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}
