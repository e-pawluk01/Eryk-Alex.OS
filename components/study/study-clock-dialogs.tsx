"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Clock } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import { TimeField } from "@/components/ui/time-field";
import { DatePills } from "@/components/ui/date-pills";
import { StudyMaterial } from "@/lib/types";
import {
  StudySession, OTHER, CUSTOM, firstWhat, missingText, formatDuration, notifyStudyChanged, sessionFields, whatOptions,
} from "@/lib/study-sessions";
import { StudyData } from "./use-study";
import { FieldLabel, ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

const hhmm = (d: Date) => format(d, "HH:mm");
const atTime = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
};
const selectClass = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none";
const secondaryButton = "w-full py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-lg border border-white/10 transition-colors";

// Overlays are portalled to <body>: the clock pill uses backdrop blur, which
// would otherwise trap a fixed overlay inside it.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/** Module pills plus "Other", then "On what": the module's dropdown, or a text box for Other. */
export function ModuleAndWhat({ study, moduleId, what, otherText, onModule, onWhat, onOtherText }: {
  study: StudyData;
  moduleId: string;
  what: string;
  otherText: string;
  onModule: (id: string) => void;
  onWhat: (v: string) => void;
  onOtherText: (v: string) => void;
}) {
  const pick = (id: string) => {
    onModule(id);
    if (id !== OTHER) onWhat(firstWhat(id, study.materials, study.deadlines, todayIso()));
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
          <OptionPill active={moduleId === OTHER} onClick={() => pick(OTHER)}>Other</OptionPill>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>On what</FieldLabel>
        {moduleId !== OTHER && <WhatSelect study={study} moduleId={moduleId} value={what} onChange={onWhat} />}
        {(moduleId === OTHER || what === CUSTOM) && (
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
    </>
  );
}

/** The first module (or Other when there are none) and its first "what". */
export function initialChoice(study: StudyData, preferModule?: string | null) {
  const moduleId = preferModule ?? study.modules[0]?.id ?? OTHER;
  return { moduleId, what: moduleId === OTHER ? "" : firstWhat(moduleId, study.materials, study.deadlines, todayIso()) };
}

/** The module's "what" dropdown: its materials, its open deadlines, revision. */
export function WhatSelect({ study, moduleId, value, onChange }: { study: StudyData; moduleId: string; value: string; onChange: (v: string) => void }) {
  const { materials, deadlines } = whatOptions(moduleId, study.materials, study.deadlines, todayIso());
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
                <button type="button" onClick={onCancel} className={secondaryButton}>{cancelLabel}</button>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: mod }, mat, dl] = await Promise.all([
        session.module_id ? supabase.from("study_modules").select("name").eq("id", session.module_id).maybeSingle() : Promise.resolve({ data: { name: "Other" } }),
        session.material_id ? supabase.from("study_materials").select("*").eq("id", session.material_id).maybeSingle() : Promise.resolve({ data: null }),
        session.deadline_id ? supabase.from("study_deadlines").select("title").eq("id", session.deadline_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const m = mat.data as StudyMaterial | null;
      const what = m?.title ?? (dl.data as { title: string } | null)?.title
        ?? (session.kind === "revision" ? "Revision" : session.kind === "practice" ? "Practice questions" : session.kind === "other" ? session.note || "Other" : "General");
      setLabel(`${(mod as { name: string } | null)?.name ?? "Study"} · ${what}`);
      if (m?.total) { setMaterial(m); setPage(String(m.current)); }
    })();
  }, [session]);

  const startDate = start === hhmm(origStart) ? origStart : atTime(origStart, start);
  const endDate = end === hhmm(origEnd) ? origEnd : atTime(end < start ? addDays(origStart, 1) : origStart, end);
  const seconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seconds <= 0 || saving) return;
    setSaving(true);
    const { error: err } = await supabase.from("study_sessions")
      .update({ started_at: startDate.toISOString(), ended_at: endDate.toISOString() })
      .eq("id", session.id);
    if (err) { setSaving(false); setError(err.message); return; }
    if (material) {
      const current = Math.max(0, Math.min(material.total ?? 0, parseInt(page) || 0));
      if (current !== material.current) await supabase.from("study_materials").update({ current }).eq("id", material.id);
    }
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
          {(seconds <= 0 || error) && <p className="text-xs text-red-400/80">{error ?? "The end has to be after the start."}</p>}
          <button type="submit" disabled={seconds <= 0 || saving} className={primaryButton}>Yes, save session</button>
        </form>
      </StudyModal>
    </Portal>
  );
}

/** Log study time you forgot to clock. */
export function StudyMissedDialog({ study, initialModule, initialWhat, initialOther, onClose }: {
  study: StudyData;
  initialModule: string;
  initialWhat: string;
  initialOther: string;
  onClose: () => void;
}) {
  const [day, setDay] = useState(startOfDay(new Date()));
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [moduleId, setModuleId] = useState(initialModule);
  const [what, setWhat] = useState(initialWhat);
  const [otherText, setOtherText] = useState(initialOther);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = atTime(day, start);
  const endDate = atTime(end < start ? addDays(day, 1) : day, end);
  const seconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  const inFuture = endDate.getTime() > Date.now() && isSameDay(day, new Date());
  const missingOther = missingText(moduleId, what, otherText);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seconds <= 0 || inFuture || missingOther || saving) return;
    setSaving(true);
    const { error: err } = await supabase.from("study_sessions").insert({
      person: study.person,
      ...sessionFields(moduleId, what, otherText),
      started_at: startDate.toISOString(),
      ended_at: endDate.toISOString(),
    });
    if (err) { setSaving(false); setError(err.message); return; }
    notifyStudyChanged();
    onClose();
  };

  return (
    <Portal>
      <StudyModal title="Add Missed Session" onClose={onClose}>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-medium text-white">Log time you forgot to clock</p>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">{formatDuration(Math.max(0, seconds))}</div>
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
          <button type="submit" disabled={seconds <= 0 || inFuture || missingOther || saving} className={primaryButton}>Save session</button>
        </form>
      </StudyModal>
    </Portal>
  );
}
