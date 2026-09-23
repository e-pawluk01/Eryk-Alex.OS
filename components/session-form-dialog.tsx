"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeField } from "./ui/time-field";
import { DatePills } from "./ui/date-pills";
import {
  WORK_TASKS, WorkSession, SessionPiece, taskColor, formatMinutes,
  saveSessionPieces, deleteSession,
} from "@/lib/work-sessions";

type Mode = "clockout" | "edit" | "add";

interface SessionFormDialogProps {
  mode: Mode;
  // The running session (clockout) or the one being fixed (edit).
  session?: WorkSession;
  // Who a newly added session belongs to.
  person: string;
  onClose: () => void;
  onSaved: () => void;
}

interface Part {
  task: string;
  hours: string;   // typed; unused for the first part, which gets the leftover
  minutes: string;
}

const COPY: Record<Mode, { label: string; question: string; save: string }> = {
  clockout: { label: "Clock Out", question: "Are these hours correct?", save: "Yes, save session" },
  edit: { label: "Edit Session", question: "Fix this session", save: "Save session" },
  add: { label: "Add Missed Session", question: "Log time you forgot to clock", save: "Save session" },
};

const hhmm = (d: Date) => format(d, "HH:mm");
const atTime = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
};
const partMinutes = (p: Part) => (Number(p.hours) || 0) * 60 + (Number(p.minutes) || 0);

export function SessionFormDialog({ mode, session, person, onClose, onSaved }: SessionFormDialogProps) {
  // Original timestamps, so an untouched time keeps its exact seconds.
  const [origStart, origEnd] = useMemo(() => {
    if (mode === "add" || !session) {
      const s = new Date(); s.setHours(10, 0, 0, 0);
      const e = new Date(); e.setHours(12, 0, 0, 0);
      return [s, e];
    }
    const start = new Date(session.started_at);
    const end = mode === "clockout" || !session.ended_at ? new Date() : new Date(session.ended_at);
    return [start, end];
  }, [mode, session]);

  const [day, setDay] = useState(startOfDay(origStart));
  const [start, setStart] = useState(hhmm(origStart));
  const [end, setEnd] = useState(hhmm(origEnd));
  const [parts, setParts] = useState<Part[]>([{ task: session?.task ?? "Sourcing", hours: "", minutes: "" }]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resolve the typed times into real dates. Untouched times keep their exact
  // original timestamps; an edited end earlier than the start means the
  // session ran past midnight.
  const dayUnchanged = isSameDay(day, origStart);
  const startDate = dayUnchanged && start === hhmm(origStart) ? origStart : atTime(day, start);
  const endDate = dayUnchanged && end === hhmm(origEnd)
    ? origEnd
    : atTime(end < start ? addDays(day, 1) : day, end);
  const totalSeconds = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000));

  const split = parts.length > 1;
  const extraSeconds = parts.slice(1).reduce((acc, p) => acc + partMinutes(p) * 60, 0);
  const firstSeconds = totalSeconds - extraSeconds;

  let error: string | null = null;
  if (totalSeconds <= 0) error = "Start and end can't be the same time.";
  else if (parts.slice(1).some((p) => partMinutes(p) <= 0)) error = "Enter a time for each task.";
  else if (split && firstSeconds < 60) error = "That's more time than the session lasted.";

  const updatePart = (i: number, patch: Partial<Part>) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const addPart = () => {
    const used = new Set(parts.map((p) => p.task));
    const next = ["Packing / Shipping", "Listing", "Photography", "Sourcing", ...WORK_TASKS].find((t) => !used.has(t)) ?? "Other";
    const give = Math.max(1, Math.min(60, Math.floor(firstSeconds / 60 / 2)));
    setParts((prev) => [...prev, { task: next, hours: String(Math.floor(give / 60)), minutes: String(give % 60) }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error || saving) return;
    setSaving(true);
    setSaveError(null);

    // Lay the pieces back-to-back in the order listed.
    const pieces: SessionPiece[] = [];
    let cursor = startDate;
    parts.forEach((p, i) => {
      const seconds = i === 0 ? firstSeconds : partMinutes(p) * 60;
      const pieceEnd = new Date(cursor.getTime() + seconds * 1000);
      pieces.push({ task: p.task, startedAt: cursor, endedAt: pieceEnd });
      cursor = pieceEnd;
    });

    const owner = session?.person ?? person;
    const result = await saveSessionPieces(owner, pieces, mode === "add" ? undefined : session?.id);
    setSaving(false);
    if (result.error) { setSaveError(result.error); return; }
    onSaved();
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    const result = await deleteSession(session.id);
    setSaving(false);
    if (result.error) { setSaveError(result.error); return; }
    onSaved();
  };

  const copy = COPY[mode];
  const fieldLabel = "text-[9px] uppercase tracking-widest font-semibold text-white/30";
  const selectClass = "w-full min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none";
  const numberClass = "w-[42px] bg-black/40 border border-white/10 rounded-lg px-1 py-2.5 text-sm text-center text-white/90 tabular-nums outline-none focus:border-white/30 transition-colors";

  // Portalled to <body>: the timer pill and the analytics view both use
  // blur/transform, which would otherwise trap a fixed overlay inside them.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative min-h-full flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-form-question"
          className="pointer-events-auto relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-full max-w-[400px] shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{copy.label}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="px-6 pb-6 pt-2 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p id="session-form-question" className="text-[15px] font-medium text-white">{copy.question}</p>
              <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">
                {totalSeconds > 0 ? (totalSeconds < 60 ? "<1m" : formatMinutes(Math.floor(totalSeconds / 60))) : "—"}
                <span className="block text-[11px] font-medium tracking-normal text-muted-foreground mt-0.5">
                  {totalSeconds > 0
                    ? `${split ? `Split across ${parts.length} tasks` : parts[0].task} · ${start}–${end}`
                    : "Check the start and end times"}
                </span>
              </div>
            </div>

            {mode !== "clockout" && (
              <div className="flex flex-col gap-2">
                <span className={fieldLabel}>Date</span>
                <DatePills value={day} onChange={setDay} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="session-start" className={fieldLabel}>Start</label>
                <TimeField id="session-start" value={start} onChange={setStart} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="session-end" className={fieldLabel}>End</label>
                <TimeField id="session-end" value={end} onChange={setEnd} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>{split ? "Tasks" : "Task"}</span>
              <div className="flex flex-col gap-2">
                {parts.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid items-center gap-2.5",
                      split ? "grid-cols-[8px_minmax(0,1fr)_auto_28px]" : "grid-cols-[8px_minmax(0,1fr)]"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: taskColor(p.task) }} />
                    <select
                      value={p.task}
                      onChange={(e) => updatePart(i, { task: e.target.value })}
                      aria-label={`Task ${i + 1}`}
                      className={selectClass}
                    >
                      {WORK_TASKS.map((t) => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                    {split && i === 0 && (
                      <>
                        <span className="text-sm text-white tabular-nums pl-3" title="Gets whatever time is left">
                          {formatMinutes(Math.max(0, Math.floor(firstSeconds / 60)))}
                        </span>
                        <span />
                      </>
                    )}
                    {split && i > 0 && (
                      <>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input
                            inputMode="numeric"
                            aria-label={`Hours on task ${i + 1}`}
                            value={p.hours}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updatePart(i, { hours: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                            className={numberClass}
                          />
                          h
                          <input
                            inputMode="numeric"
                            aria-label={`Minutes on task ${i + 1}`}
                            value={p.minutes}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                              updatePart(i, { minutes: v === "" ? "" : String(Math.min(59, Number(v))) });
                            }}
                            className={numberClass}
                          />
                          m
                        </span>
                        <button
                          type="button"
                          onClick={() => setParts((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Remove this task"
                          className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground/50 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {split && (
                <>
                  <div className="flex gap-0.5 h-1.5 mt-1">
                    {parts.map((p, i) => {
                      const secs = i === 0 ? Math.max(0, firstSeconds) : partMinutes(p) * 60;
                      return (
                        <i
                          key={i}
                          className="block h-full first:rounded-l-sm last:rounded-r-sm"
                          style={{ flex: secs, background: taskColor(p.task) }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">The first task gets whatever time is left.</p>
                </>
              )}

              <button
                type="button"
                onClick={addPart}
                disabled={firstSeconds < 120}
                className="self-start pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors disabled:opacity-35 disabled:hover:text-muted-foreground"
              >
                + Add another task
              </button>
            </div>

            {(error || saveError) && (
              <p className="text-xs text-red-400/80 -mt-1">{saveError ?? error}</p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={!!error || saving}
                className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {saving ? "Saving..." : copy.save}
              </button>
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-full py-2.5 border border-red-400/25 text-red-400/80 font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  {confirmDelete ? "Tap again to delete" : "Delete session"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
