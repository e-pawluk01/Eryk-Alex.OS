"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { WORK_TASKS, WorkSession, sessionLabel, switchSession, taskColor, workedSeconds } from "@/lib/work-sessions";

interface SwitchTaskDialogProps {
  current: WorkSession;
  // Your other open sessions, paused when you switched away from them.
  parked: WorkSession[];
  formatTime: (totalSeconds: number) => string;
  onClose: () => void;
}

export function SwitchTaskDialog({ current, parked, formatTime, onClose }: SwitchTaskDialogProps) {
  // Every task but the one you're on ("Other" can always be another thing).
  const choices = WORK_TASKS.filter((t) => t === "Other" || t !== current.task);
  const [task, setTask] = useState<string>(choices[0]);
  const [note, setNote] = useState("");
  const missingNote = task === "Other" && !note.trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Keep the current task's time moving while the dialog is open.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = async (to: Parameters<typeof switchSession>[1]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await switchSession(current, to);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missingNote) return;
    // Picking a task you already have paused picks that one back up.
    const paused = task !== "Other" && parked.find((s) => s.task === task);
    go(paused ? { resume: paused } : { task, note });
  };

  const fieldLabel = "text-[9px] uppercase tracking-widest font-semibold text-white/30";

  // Portalled to <body>: the timer pill uses blur/transform, which would
  // otherwise trap this fixed overlay inside it.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Switch Task</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
          <div className="flex items-center gap-2.5 bg-black/40 border border-white/10 rounded-lg px-3 py-3">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: taskColor(current.task) }} />
            <span className="flex-1 min-w-0 truncate text-sm text-white/90">{sessionLabel(current)}</span>
            <span className="text-sm text-white/90 tabular-nums">{formatTime(Math.floor(workedSeconds(current)))}</span>
          </div>

          {parked.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>Paused Tasks</span>
              {parked.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 border border-white/10 rounded-lg pl-3 pr-1.5 py-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: taskColor(s.task) }} />
                  <span className="flex-1 min-w-0 truncate text-sm text-white/90">{sessionLabel(s)}</span>
                  <span className="text-xs text-white/50 tabular-nums">{formatTime(Math.floor(workedSeconds(s)))}</span>
                  <button
                    type="button"
                    onClick={() => go({ resume: s })}
                    disabled={busy}
                    className="px-3 py-2 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-md hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="switch-task" className={fieldLabel}>Switch To</label>
            <select
              id="switch-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              disabled={busy}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none"
            >
              {choices.map((t) => (
                <option key={t} value={t} className="bg-zinc-900">{t}</option>
              ))}
            </select>
            {task === "Other" && (
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What are you doing?"
                autoFocus
                disabled={busy}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 placeholder:text-white/25"
              />
            )}
          </div>

          {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}

          <button
            type="submit"
            disabled={busy || missingNote}
            className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {busy ? "Switching..." : "Switch"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
