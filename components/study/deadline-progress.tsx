"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { StudyDeadline, StudyModule } from "@/lib/types";
import { isOpenNow, progressPct, windowGone } from "@/lib/study";
import { ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

type Progress = Pick<StudyDeadline, "progress_mode" | "progress_done" | "progress_total" | "progress_pct">;

/** One bar: how much you've done (fill) and, for open windows, how much time has gone (white tick). */
export function ProgressBar({ deadline, module }: { deadline: StudyDeadline; module?: StudyModule }) {
  const pct = progressPct(deadline) ?? 0;
  const gone = deadline.opens_on && isOpenNow(deadline) ? windowGone(deadline) : null;
  return (
    <div className="relative h-1 w-full rounded-full bg-white/[0.12]" title={gone !== null ? `${Math.round(pct)}% done · ${Math.round(gone)}% of the window gone` : `${Math.round(pct)}% done`}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: module?.color ?? "#888" }} />
      {gone !== null && gone > 0 && gone < 100 && (
        <div className="absolute -top-[3px] w-0.5 h-2.5 rounded-sm bg-white" style={{ left: `calc(${gone}% - 1px)` }} />
      )}
    </div>
  );
}

const box = "w-16 text-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/30 font-mono tabular-nums";

/** The "by parts / by percentage" inputs, used in the pop-up and when clocking out. */
export function ProgressFields({ value, onChange, color }: { value: Progress; onChange: (v: Progress) => void; color?: string }) {
  const mode = value.progress_mode ?? "parts";
  const pct = mode === "parts"
    ? (value.progress_total ? Math.min(100, ((value.progress_done ?? 0) / value.progress_total) * 100) : 0)
    : value.progress_pct ?? 0;
  const digits = (s: string) => { const n = s.replace(/\D/g, ""); return n === "" ? null : Number(n); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <OptionPill active={mode === "parts"} onClick={() => onChange({ ...value, progress_mode: "parts" })}>By parts</OptionPill>
        <OptionPill active={mode === "percent"} onClick={() => onChange({ ...value, progress_mode: "percent" })}>By percentage</OptionPill>
      </div>
      {mode === "parts" ? (
        <div className="flex items-center gap-3">
          <input type="text" inputMode="numeric" aria-label="Parts done" value={value.progress_done ?? ""} placeholder="0"
            onChange={e => onChange({ ...value, progress_mode: "parts", progress_done: digits(e.target.value) })} onFocus={e => e.target.select()} className={box} />
          <span className="text-xs text-muted-foreground">of</span>
          <input type="text" inputMode="numeric" aria-label="Total parts" value={value.progress_total ?? ""} placeholder="5"
            onChange={e => onChange({ ...value, progress_mode: "parts", progress_total: digits(e.target.value) })} onFocus={e => e.target.select()} className={box} />
          <span className="text-xs text-muted-foreground">parts (e.g. questions)</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={5} value={value.progress_pct ?? 0} aria-label="Percentage done"
            onChange={e => onChange({ ...value, progress_mode: "percent", progress_pct: Number(e.target.value) })} className="flex-1 accent-white" />
          <span className="font-mono text-sm w-12 text-right tabular-nums">{value.progress_pct ?? 0}%</span>
        </div>
      )}
      <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? "#888" }} />
      </div>
    </div>
  );
}

export function progressOf(d: StudyDeadline): Progress {
  return { progress_mode: d.progress_mode ?? "parts", progress_done: d.progress_done, progress_total: d.progress_total, progress_pct: d.progress_pct };
}

/** "How far are you?" for one deadline. */
export function DeadlineProgressDialog({ deadline, module, onSave, onClose, onDetails }: {
  deadline: StudyDeadline;
  module?: StudyModule;
  onSave: (p: Progress) => void;
  onClose: () => void;
  onDetails: () => void;
}) {
  const [value, setValue] = useState<Progress>(progressOf(deadline));
  return createPortal(
    <StudyModal title="How far are you?" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave(value); onClose(); }} className="flex flex-col gap-6">
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><ModuleDot module={module} />{deadline.title}</span>
        <ProgressFields value={value} onChange={setValue} color={module?.color} />
        <div className="flex flex-col gap-2">
          <button type="submit" className={primaryButton}>Save</button>
          <button type="button" onClick={onDetails} className="text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white py-2 transition-colors">Open details</button>
        </div>
      </form>
    </StudyModal>,
    document.body
  );
}
