"use client";

interface SkuGeneratedNoticeProps {
  sku: string | null;
  onClose: () => void;
}

// A SKU spent mid-generation is a real, permanent side effect (it's already
// in the sheet) regardless of what happens to the rest of the request, so
// this interrupts on the spot rather than being a quiet, missable label.
export function SkuGeneratedNotice({ sku, onClose }: SkuGeneratedNoticeProps) {
  if (!sku) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4 p-6 flex flex-col items-center gap-3 text-center">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
        <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-semibold">SKU Generated</span>
        <span className="text-3xl font-mono text-white tracking-wider">{sku}</span>
        <span className="text-[10px] text-white/40">Added to the sheet — this is used now no matter what happens next.</span>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-all mt-2"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
