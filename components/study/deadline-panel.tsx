"use client";

import React, { useEffect, useState } from "react";
import { X, Trash2, Flag, CalendarClock } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isOpenNow, shortDate, shortTime, typesFor, windowGone } from "@/lib/study";
import { StudyDeadline } from "@/lib/types";
import { StudyData } from "./use-study";
import { Countdown, FieldLabel, ModuleDot, OptionPill, TypeChip, WindowBar } from "./bits";

/** Slide-over with everything about one deadline; edits save as you go. */
export function DeadlinePanel({ study, deadline, onClose }: { study: StudyData; deadline: StudyDeadline | null; onClose: () => void }) {
  const [titleDraft, setTitleDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    setTitleDraft(deadline.title);
    setNoteDraft(deadline.note ?? "");
    setScoreDraft(deadline.score ?? "");
  }, [deadline?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!deadline) return null;
  const module = study.modules.find(m => m.id === deadline.module_id);
  const save = (updates: Partial<StudyDeadline>) => study.updateDeadline(deadline.id, updates);
  const gone = windowGone(deadline);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-black/80 backdrop-blur-2xl border-l border-white/10 z-[70] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex flex-col gap-4 p-6 border-b border-white/5">
          <div className="flex items-center justify-between gap-4">
            <TypeChip type={deadline.type} module={module} />
            <button onClick={onClose} className="p-1.5 -mr-1.5 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <ModuleDot module={module} className="w-2.5 h-2.5" />
            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => titleDraft.trim() && titleDraft !== deadline.title && save({ title: titleDraft.trim() })}
              className="w-full bg-transparent text-xl font-semibold text-white outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Fact label={deadline.opens_on ? "Cut-off" : "Due"}>
              <span className="text-sm text-white">{shortDate(deadline.cutoff_on)}</span>
              <span className="text-[11px] text-muted-foreground">{shortTime(deadline.cutoff_time) ?? "no time"}</span>
            </Fact>
            <Fact label={deadline.done ? "Status" : "Left"}>
              {deadline.done ? <span className="text-sm text-white">Done</span> : <Countdown deadline={deadline} className="text-sm" />}
            </Fact>
            <Fact label="Window">
              <span className="text-sm text-white">{gone === null ? "—" : isOpenNow(deadline) ? `${Math.round(gone)}% gone` : "Not open"}</span>
            </Fact>
          </div>
          {deadline.opens_on && <WindowBar deadline={deadline} module={module} />}
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <FieldLabel>Cut-off</FieldLabel>
            <div className="flex items-center gap-6 text-xs">
              <DatePicker value={deadline.cutoff_on} onChange={d => d && save({ cutoff_on: d })} icon={<Flag className="w-3.5 h-3.5 text-muted-foreground" />} />
              <TimeField id="panel-cutoff-time" value={shortTime(deadline.cutoff_time) ?? ""} onChange={t => save({ cutoff_time: t || null })} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel>Opens · optional</FieldLabel>
            <div className="text-xs">
              <DatePicker value={deadline.opens_on} onChange={d => save({ opens_on: d })} placeholder="No start date" icon={<CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel>Module</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {study.modules.map(m => (
                <OptionPill key={m.id} active={m.id === deadline.module_id} onClick={() => save({ module_id: m.id })}>
                  <ModuleDot module={m} />{m.name}
                </OptionPill>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel>Type</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {typesFor(study.person ?? "", study.deadlines).map(t => (
                <OptionPill key={t} active={t === deadline.type} onClick={() => save({ type: t })}>{t}</OptionPill>
              ))}
            </div>
          </div>
          {deadline.done && (
            <div className="flex flex-col gap-2">
              <FieldLabel>Score · optional</FieldLabel>
              <input
                type="text"
                value={scoreDraft}
                onChange={e => setScoreDraft(e.target.value)}
                onBlur={() => scoreDraft !== (deadline.score ?? "") && save({ score: scoreDraft.trim() || null })}
                placeholder="e.g. 78%"
                className="bg-transparent border-b border-white/5 pb-2 text-sm text-white focus:outline-none focus:border-white/30 font-mono"
              />
            </div>
          )}
          <div className="flex flex-col gap-2 flex-1">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => noteDraft !== (deadline.note ?? "") && save({ note: noteDraft || null })}
              placeholder="Word count, question numbers, anything to remember…"
              className="w-full flex-1 bg-transparent text-sm text-foreground/90 focus:outline-none resize-none leading-relaxed min-h-[120px]"
            />
          </div>
        </div>

        <div className="p-6 bg-zinc-950/50 border-t border-white/5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="p-3 hover:bg-red-500/20 rounded-lg transition-colors text-red-500/50 hover:text-red-500 shrink-0"
            title="Delete Deadline"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => save({ done: !deadline.done })}
            className="flex-1 py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            {deadline.done ? "Move back to upcoming" : "Mark done"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { study.deleteDeadline(deadline.id); setConfirmDelete(false); onClose(); }}
        title="Delete Deadline?"
        description="Are you sure you want to delete this deadline? This action cannot be undone."
      />
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
