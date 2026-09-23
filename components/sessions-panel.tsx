"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { Breakdown } from "./breakdown";
import { WorkSession, PERSON_COLORS, taskColor, formatMinutes } from "@/lib/work-sessions";

interface SessionsPanelProps {
  sessions: WorkSession[]; // this month's finished sessions, newest first
  onEdit: (session: WorkSession) => void;
  onAdd: () => void;
}

const INITIAL_ROWS = 8;
const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3.5";

// What opens under the Total Hours card: who worked it, and the sessions
// themselves with edit and add-missed.
export function SessionsPanel({ sessions, onEdit, onAdd }: SessionsPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const hoursBy = (person: string) =>
    sessions.filter((s) => s.person === person).reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;

  const rows = showAll ? sessions : sessions.slice(0, INITIAL_ROWS);

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-7 md:gap-10">
        <div>
          <p className={labelClass}>By person</p>
          <Breakdown
            items={["Eryk", "Alex"].map((p) => ({ label: p, value: hoursBy(p), color: PERSON_COLORS[p] }))}
            format={(v) => `${v.toFixed(1)}h`}
          />
        </div>

        <div className="flex flex-col">
          <p className={labelClass}>Sessions</p>
          {sessions.length === 0 && (
            <p className="text-[13px] text-muted-foreground/60 py-2">No sessions logged this month yet.</p>
          )}
          <div>
            {rows.map((s) => {
              const start = new Date(s.started_at);
              const end = s.ended_at ? new Date(s.ended_at) : start;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[8px_minmax(0,1fr)_auto_28px] gap-3 items-center py-2.5 text-[13px] border-t border-white/5 first:border-t-0"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: taskColor(s.task) }} />
                  <span className="min-w-0">
                    <span className="block truncate text-white">{s.task}</span>
                    <span className="block text-[11px] text-muted-foreground/50 tabular-nums mt-0.5">
                      {s.person} · {format(start, "EEE d MMM")} · {format(start, "HH:mm")}–{format(end, "HH:mm")}
                    </span>
                  </span>
                  <span className="tabular-nums text-white">{formatMinutes(Math.floor((s.duration || 0) / 60))}</span>
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    aria-label={`Edit ${s.task} session`}
                    title="Edit"
                    className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-5">
            {!showAll && sessions.length > INITIAL_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
              >
                Show all {sessions.length}
              </button>
            )}
            <button
              type="button"
              onClick={onAdd}
              className="pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
            >
              + Add missed session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
