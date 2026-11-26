"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Clock } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import { TimeField } from "@/components/ui/time-field";
import { DatePills } from "@/components/ui/date-pills";
import { StudyDeadline, StudyMaterial, Task } from "@/lib/types";
import {
  StudySession, OTHER, CUSTOM, TASK, STUDY_CHANGED_EVENT, addTaskTime, untickIfShort, firstWhat, missingText, formatDuration, minutesLeft, notifyStudyChanged, sessionFields, whatLabel, whatOptions,
} from "@/lib/study-sessions";
import { StudyData, useStudy } from "./use-study";
import { ProgressFields, progressOf } from "./deadline-progress";
import { FieldLabel, ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

const hhmm = (d: Date) => format(d, "HH:mm");
const atTime = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
};
const selectClass = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none";
const pausedBox = "w-14 bg-black/40 border border-white/10 rounded-lg px-1 py-2.5 text-sm text-center text-white/90 tabular-nums outline-none focus:border-white/30 transition-colors";
const secondaryButton = "w-full py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-lg border border-white/10 transition-colors";

// Overlays are portalled to <body>: the clock pill uses backdrop blur, which
// would otherwise trap a fixed overlay inside it.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/** Today's open timed Study tasks, in the order they were added. */
export function useTodaysTimedTasks(person: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!person) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("tasks").select("*")
        .eq("context", person).eq("domain", "STUDY").eq("status", "todo")
        .eq("scheduled_date", todayIso()).not("time_limit_minutes", "is", null)
        .order("created_at");
      if (error) { console.error("Failed to load timed tasks:", error); return; }
      if (alive) setTasks(data as Task[]);
    };
    load();
    window.addEventListener(STUDY_CHANGED_EVENT, load);
    return () => { alive = false; window.removeEventListener(STUDY_CHANGED_EVENT, load); };
  }, [person]);
  return tasks;
}

/**
 * Module pills plus "Task" (when there are timed tasks today) and "Other",
 * then "On what": the module's dropdown, today's tasks, or a text box for Other.
 */
export function ModuleAndWhat({ study, moduleId, what, otherText, onModule, onWhat, onOtherText, tasks, taskId, onTask, noText }: {
  study: StudyData;
  moduleId: string;
  what: string;
  otherText: string;
  onModule: (id: string) => void;
  onWhat: (v: string) => void;
  onOtherText: (v: string) => void;
  tasks?: Task[];
  taskId?: string | null;
  onTask?: (task: Task) => void;
  // No text box for Other / Something else (a task uses its own name).
  noText?: boolean;
}) {
  const pick = (id: string) => {
    onModule(id);
    if (id === TASK) { if (tasks?.[0] && !tasks.some(t => t.id === taskId)) onTask?.(tasks[0]); }
    else if (id !== OTHER) onWhat(firstWhat(id, study.materials, study.deadlines, todayIso()));
  };
  return (
    <>
      <div className="flex flex-col gap-2">
        <FieldLabel>Module</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {study.modules.map(m => (
            <OptionPill key={m.id} active={moduleId === m.id} onClick={() => pick(m.id)}>
              <ModuleDot module={m} />{m.name}
            </OptionPill>
          ))}
          {!!tasks?.length && <OptionPill active={moduleId === TASK} onClick={() => pick(TASK)}>Task</OptionPill>}
          <OptionPill active={moduleId === OTHER} onClick={() => pick(OTHER)}>Other</OptionPill>
        </div>
      </div>
      {moduleId === TASK ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Today</FieldLabel>
          <div className="flex flex-col gap-1.5">
            {(tasks ?? []).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTask?.(t)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${t.id === taskId ? "border-white/35 bg-white/[0.06] text-white" : "border-white/10 text-white/70 hover:text-white hover:border-white/20"}`}
              >
                <span className="truncate">{t.title}</span>
                <span className="font-mono text-xs tabular-nums text-white/50">{formatDuration(minutesLeft(t) * 60)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        <FieldLabel>On what</FieldLabel>
        {moduleId !== OTHER && <WhatSelect study={study} moduleId={moduleId} value={what} onChange={onWhat} />}
        {!noText && (moduleId === OTHER || what === CUSTOM) && (
          <input
            type="text"
            value={otherText}
            onChange={e => onOtherText(e.target.value)}
            placeholder="What are you doing?"
            autoFocus
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 placeholder:text-white/25"
          />
        )}
      </div>
      )}
    </>
  );
}

/**
 * A timed task's Module and On what: the time it's clocked for is logged there.
 * Other (no module) logs it as Other with the task's name.
 */
export function TaskModuleFields({ person, moduleId, what, onChange }: {
  person: string;
  moduleId: string | null;
  what: string | null;
  onChange: (moduleId: string | null, what: string | null) => void;
}) {
  const study = useStudy(person);
  const [mod, setMod] = useState(moduleId ?? OTHER);
  const [wh, setWh] = useState(what ?? "");
  // Picking a module sets both at once, so report after they settle.
  useEffect(() => {
    const m = mod === OTHER ? null : mod;
    const w = mod === OTHER ? null : wh || null;
    if (m !== (moduleId ?? null) || w !== (what ?? null)) onChange(m, w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, wh]);
  if (!study.modules.length) return null;
  return <ModuleAndWhat study={study} moduleId={mod} what={wh} otherText="" onModule={setMod} onWhat={setWh} onOtherText={() => {}} noText />;
}

/** The first module (or Other when there are none) and its first "what". */
export function initialChoice(study: StudyData, preferModule?: string | null) {
  const moduleId = preferModule ?? study.modules[0]?.id ?? OTHER;
  return { moduleId, what: moduleId === OTHER ? "" : firstWhat(moduleId, study.materials, study.deadlines, todayIso()) };
}

/** The module's "what" dropdown: its materials, its open deadlines, revision. */
export function WhatSelect({ study, moduleId, value, onChange }: { study: StudyData; moduleId: string; value: string; onChange: (v: string) => void }) {
  const options = whatOptions(moduleId, study.materials, study.deadlines, todayIso());
  // Editing a past session: keep its finished material or closed deadline in the list.
  const keepMaterial = value.startsWith("material:") ? study.materials.find(m => `material:${m.id}` === value) : undefined;
  const keepDeadline = value.startsWith("deadline:") ? study.deadlines.find(d => `deadline:${d.id}` === value) : undefined;
  const materials = keepMaterial && !options.materials.includes(keepMaterial) ? [...options.materials, keepMaterial] : options.materials;
  const deadlines = keepDeadline && !options.deadlines.includes(keepDeadline) ? [...options.deadlines, keepDeadline] : options.deadlines;
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={selectClass} aria-label="On what">
      {materials.length > 0 && (
        <optgroup label="Materials" className="bg-zinc-900">
          {materials.map(m => <option key={m.id} value={`material:${m.id}`}>{m.title}</option>)}
        </optgroup>
      )}
      {deadlines.length > 0 && (
        <optgroup label="Open deadlines" className="bg-zinc-900">
          {deadlines.map(d => <option key={d.id} value={`deadline:${d.id}`}>{d.title}</option>)}
        </optgroup>
      )}
      <option value="revision" className="bg-zinc-900">Revision</option>
      <option value="practice" className="bg-zinc-900">Practice questions</option>
      <option value="preparation" className="bg-zinc-900">Preparation</option>
      <option value={CUSTOM} className="bg-zinc-900">Something else…</option>
    </select>
  );
}

/** Centred question with an icon and two buttons (Work clash, timer ring). */
export function PromptDialog({ icon, title, detail, confirmLabel, cancelLabel, onConfirm, onCancel, stacked, mustChoose }: {
  icon: "clock" | "bell";
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  stacked?: boolean;
  // Clicking outside does nothing: one of the buttons has to be pressed.
  mustChoose?: boolean;
}) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={mustChoose ? undefined : onCancel} />
        <div className="relative bg-zinc-950/90 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 flex flex-col items-center p-8 text-center">
          {icon === "clock" ? (
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 border bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
              <Clock className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 border border-white/20 text-white">
              <Bell className="w-6 h-6" />
            </div>
          )}
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/50 mb-8">{detail}</p>
          <div className={stacked ? "flex flex-col w-full gap-3" : "grid grid-cols-2 w-full gap-3"}>
            {stacked ? (
              <>
                <button type="button" onClick={onConfirm} className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-colors">{confirmLabel}</button>
                {cancelLabel && <button type="button" onClick={onCancel} className={secondaryButton}>{cancelLabel}</button>}
              </>
            ) : (
              <>
                <button type="button" onClick={onCancel} className={secondaryButton}>{cancelLabel}</button>
                <button type="button" onClick={onConfirm} className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-colors">{confirmLabel}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * "Are these hours correct?" for a running study session. Loads the names it
 * needs itself, so the Work clock can use it too.
 */
export function StudyClockOutDialog({ session, onClose, onSaved }: { session: StudySession; onClose: () => void; onSaved: () => void }) {
  const origStart = useMemo(() => new Date(session.started_at), [session.started_at]);
  const origEnd = useMemo(() => new Date(), []);
  const [start, setStart] = useState(hhmm(origStart));
  const [end, setEnd] = useState(hhmm(origEnd));
  const [label, setLabel] = useState("");
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [page, setPage] = useState("");
  // Clocking out of a deadline asks how far you are, like a material's page.
  const [deadline, setDeadline] = useState<StudyDeadline | null>(null);
  const [progress, setProgress] = useState<ReturnType<typeof progressOf> | null>(null);
  const [moduleColor, setModuleColor] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cancel deletes the running session: none of its time is saved. Tap twice.
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Time paused so far (including a pause still going), taken off the total.
  const origPaused = useMemo(
    () => Math.round((session.paused_seconds ?? 0) + (session.paused_at ? (origEnd.getTime() - new Date(session.paused_at).getTime()) / 1000 : 0)),
    [session.paused_seconds, session.paused_at, origEnd]
  );
  const [pausedH, setPausedH] = useState(String(Math.floor(Math.round(origPaused / 60) / 60)));
  const [pausedM, setPausedM] = useState(String(Math.round(origPaused / 60) % 60));

  useEffect(() => {
    (async () => {
      const [{ data: mod }, mat, dl] = await Promise.all([
        session.module_id ? supabase.from("study_modules").select("name, color").eq("id", session.module_id).maybeSingle() : Promise.resolve({ data: { name: "Other", color: undefined } }),
        session.material_id ? supabase.from("study_materials").select("*").eq("id", session.material_id).maybeSingle() : Promise.resolve({ data: null }),
        session.deadline_id ? supabase.from("study_deadlines").select("*").eq("id", session.deadline_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const m = mat.data as StudyMaterial | null;
      const what = m?.title ?? (dl.data as { title: string } | null)?.title ?? whatLabel(session, [], []);
      setLabel(`${(mod as { name: string } | null)?.name ?? "Study"} · ${what}`);
      if (m?.total) { setMaterial(m); setPage(String(m.current)); }
      const d = dl.data as StudyDeadline | null;
      if (d && !d.done) { setDeadline(d); setProgress(progressOf(d)); }
      setModuleColor((mod as { color?: string } | null)?.color);
    })();
  }, [session]);

  const startDate = start === hhmm(origStart) ? origStart : atTime(origStart, start);
  const endDate = end === hhmm(origEnd) ? origEnd : atTime(end < start ? addDays(origStart, 1) : origStart, end);
  const span = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  const typedPaused = ((parseInt(pausedH) || 0) * 60 + (parseInt(pausedM) || 0)) * 60;
  const pausedSecs = typedPaused === Math.round(origPaused / 60) * 60 ? origPaused : typedPaused;
  const seconds = span - pausedSecs;

  const handleCancel = async () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    if (saving) return;
    setSaving(true);
    const { data, error: err } = await supabase.from("study_sessions").delete().eq("id", session.id).select("id");
    // The database skips rows it won't let us delete without an error, so check one went.
    if (err || !data?.length) { setSaving(false); setError(err?.message ?? "The database didn't allow this session to be cancelled."); return; }
    if (session.task_id) await untickIfShort(session.task_id);
    notifyStudyChanged();
    onSaved();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seconds <= 0 || saving) return;
    setSaving(true);
    const { error: err } = await supabase.from("study_sessions")
      .update({ started_at: startDate.toISOString(), ended_at: endDate.toISOString(), paused_at: null, paused_seconds: pausedSecs })
      .eq("id", session.id);
    if (err) { setSaving(false); setError(err.message); return; }
    if (material) {
      const current = Math.max(0, Math.min(material.total ?? 0, parseInt(page) || 0));
      if (current !== material.current) await supabase.from("study_materials").update({ current }).eq("id", material.id);
    }
    if (deadline && progress) await supabase.from("study_deadlines").update(progress).eq("id", deadline.id);
    if (session.task_id) await addTaskTime(session.task_id, seconds);
    notifyStudyChanged();
    onSaved();
  };

  return (
    <Portal>
      <StudyModal title="Clock Out" onClose={onClose}>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-medium text-white">Are these hours correct?</p>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">
              {formatDuration(Math.max(0, seconds))}
              <span className="block text-[11px] font-medium tracking-normal text-muted-foreground mt-0.5">{label}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2"><FieldLabel>Start</FieldLabel><TimeField id="study-out-start" value={start} onChange={setStart} /></div>
            <div className="flex flex-col gap-2"><FieldLabel>End</FieldLabel><TimeField id="study-out-end" value={end} onChange={setEnd} /></div>
          </div>
          {origPaused > 0 && (
            <div className="flex flex-col gap-2">
              <FieldLabel>Paused</FieldLabel>
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <input inputMode="numeric" aria-label="Hours paused" value={pausedH} onFocus={e => e.target.select()}
                  onChange={e => setPausedH(e.target.value.replace(/\D/g, "").slice(0, 2))} className={pausedBox} />
                h
                <input inputMode="numeric" aria-label="Minutes paused" value={pausedM} onFocus={e => e.target.select()}
                  onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); setPausedM(v === "" ? "" : String(Math.min(59, Number(v)))); }} className={pausedBox} />
                m
              </span>
            </div>
          )}
          {material && (
            <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
              <FieldLabel>{material.title} · where are you up to?</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={page}
                  onChange={e => setPage(e.target.value.replace(/\D/g, ""))}
                  onFocus={e => e.target.select()}
                  className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/30 font-mono tabular-nums"
                />
                <span className="font-mono text-xs text-muted-foreground">/ {material.total} {material.unit}</span>
              </div>
            </div>
          )}
          {deadline && progress && (
            <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4">
              <FieldLabel>{deadline.title} · how far are you?</FieldLabel>
              <ProgressFields value={progress} onChange={setProgress} color={moduleColor} />
            </div>
          )}
          {(seconds <= 0 || error) && <p className="text-xs text-red-400/80">{error ?? (span > 0 ? "Paused is longer than the session." : "The end has to be after the start.")}</p>}
          <div className="flex flex-col gap-2">
            <button type="submit" disabled={seconds <= 0 || saving} className={primaryButton}>Yes, save session</button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="w-full py-2.5 border border-red-400/25 text-red-400/80 font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              {confirmCancel ? "Tap again to cancel" : "Cancel session"}
            </button>
          </div>
        </form>
      </StudyModal>
    </Portal>
  );
}

/**
 * Clock out of several open sessions (the current one and any switched away
 * from), one "Are these hours correct?" after another. Closing stops there.
 */
export function StudyClockOutAll({ sessions, onClose, onSaved }: { sessions: StudySession[]; onClose: () => void; onSaved: () => void }) {
  // Kept as they were when it opened: the list refreshes as each one is saved.
  const [queue] = useState(sessions);
  const [index, setIndex] = useState(0);
  const session = queue[index];
  if (!session) return null;
  const next = () => { if (index + 1 < queue.length) setIndex(index + 1); else onSaved(); };
  return <StudyClockOutDialog key={session.id} session={session} onClose={onClose} onSaved={next} />;
}

/** Log study time you forgot to clock, or fix a past session (when `session` is given). */
export function StudyMissedDialog({ study, session, initialModule, initialWhat, initialOther, onClose }: {
  study: StudyData;
  session?: StudySession;
  initialModule: string;
  initialWhat: string;
  initialOther: string;
  onClose: () => void;
}) {
  const origStart = session ? new Date(session.started_at) : null;
  const origEnd = session?.ended_at ? new Date(session.ended_at) : null;
  const [day, setDay] = useState(startOfDay(origStart ?? new Date()));
  const [start, setStart] = useState(origStart ? hhmm(origStart) : "10:00");
  const [end, setEnd] = useState(origEnd ? hhmm(origEnd) : "12:00");
  const [moduleId, setModuleId] = useState(initialModule);
  const [what, setWhat] = useState(initialWhat);
  const [otherText, setOtherText] = useState(initialOther);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // An untouched time keeps its exact seconds.
  const startDate = origStart && isSameDay(day, origStart) && start === hhmm(origStart) ? origStart : atTime(day, start);
  const endDay = end < start ? addDays(day, 1) : day;
  const endDate = origEnd && isSameDay(endDay, origEnd) && end === hhmm(origEnd) ? origEnd : atTime(endDay, end);
  const seconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  // Time paused stays taken off, but never more than the session now lasts.
  const paused = Math.min(session?.paused_seconds ?? 0, Math.max(0, seconds));
  const inFuture = endDate.getTime() > Date.now() && isSameDay(day, new Date());
  const missingOther = missingText(moduleId, what, otherText);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seconds <= 0 || inFuture || missingOther || saving) return;
    setSaving(true);
    const fields = {
      ...sessionFields(moduleId, what, otherText),
      started_at: startDate.toISOString(),
      ended_at: endDate.toISOString(),
    };
    const { error: err } = session
      ? await supabase.from("study_sessions").update({ ...fields, paused_seconds: paused }).eq("id", session.id)
      : await supabase.from("study_sessions").insert({ person: study.person, ...fields });
    if (err) { setSaving(false); setError(err.message); return; }
    notifyStudyChanged();
    onClose();
  };

  const handleDelete = async () => {
    if (!session || saving) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    const { error: err } = await supabase.from("study_sessions").delete().eq("id", session.id);
    if (err) { setSaving(false); setError(err.message); return; }
    notifyStudyChanged();
    onClose();
  };

  return (
    <Portal>
      <StudyModal title={session ? "Edit Session" : "Add Missed Session"} onClose={onClose}>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-medium text-white">{session ? "Fix this session" : "Log time you forgot to clock"}</p>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">{formatDuration(Math.max(0, seconds - paused))}</div>
            {paused > 0 && <p className="text-xs text-white/40">{formatDuration(paused)} paused, not counted</p>}
          </div>
          <div className="flex flex-col gap-2"><FieldLabel>Date</FieldLabel><DatePills value={day} onChange={setDay} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2"><FieldLabel>Start</FieldLabel><TimeField id="study-missed-start" value={start} onChange={setStart} /></div>
            <div className="flex flex-col gap-2"><FieldLabel>End</FieldLabel><TimeField id="study-missed-end" value={end} onChange={setEnd} /></div>
          </div>
          <ModuleAndWhat study={study} moduleId={moduleId} what={what} otherText={otherText} onModule={setModuleId} onWhat={setWhat} onOtherText={setOtherText} />
          {(seconds <= 0 || inFuture || error) && (
            <p className="text-xs text-red-400/80">{error ?? (inFuture ? "That session hasn't finished yet." : "The end has to be after the start.")}</p>
          )}
          <div className="flex flex-col gap-2">
            <button type="submit" disabled={seconds <= 0 || inFuture || missingOther || saving} className={primaryButton}>Save session</button>
            {session && (
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
      </StudyModal>
    </Portal>
  );
}
