"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyDeadline, StudyModule } from "@/lib/types";
import { countdown, daysUntil, isOpenNow, urgency, URGENCY_TEXT, windowGone } from "@/lib/study";

export function ModuleDot({ module, className }: { module?: StudyModule; className?: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", className)} style={{ background: module?.color ?? "#555" }} />;
}

export function TypeChip({ type, module }: { type: string; module?: StudyModule }) {
  const color = module?.color ?? "#a3a3a3";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-widest font-bold border whitespace-nowrap bg-white/[0.02]"
      style={{ color, borderColor: `${color}66` }}
    >
      {type}
    </span>
  );
}

/** "Open now" / "Opens in 5d" for deadlines with a start date. */
export function OpenTag({ deadline }: { deadline: StudyDeadline }) {
  if (!deadline.opens_on) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-widest font-bold border border-border text-muted-foreground whitespace-nowrap">
      {isOpenNow(deadline) ? "Open now" : `Opens in ${countdown(daysUntil(deadline.opens_on))}`}
    </span>
  );
}

/** Days to the cut-off, coloured grey → white → amber → red as it nears. */
export function Countdown({ deadline, className }: { deadline: StudyDeadline; className?: string }) {
  const days = daysUntil(deadline.cutoff_on);
  return <span className={cn("font-mono tabular-nums", URGENCY_TEXT[urgency(days)], className)}>{countdown(days)}</span>;
}

/** Thin bar of how much of the open window is gone (fill grows towards the cut-off). */
export function WindowBar({ deadline, module }: { deadline: StudyDeadline; module?: StudyModule }) {
  const pct = windowGone(deadline);
  if (pct === null) return null;
  return (
    <div className="h-1 rounded-full bg-white/[0.12] overflow-hidden" title={`${Math.round(pct)}% of the window gone`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: module?.color ?? "#888" }} />
    </div>
  );
}

/** The app's standard centred pop-up. */
export function StudyModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg overflow-visible shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{title}</span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">{children}</label>;
}

export function OptionPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors",
        active ? "border-white/35 text-white bg-white/[0.06]" : "border-border text-muted-foreground hover:text-white hover:border-white/20"
      )}
    >
      {children}
    </button>
  );
}

export const primaryButton = "w-full flex items-center justify-center gap-2 bg-white text-black py-3 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
