"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { Breakdown } from "@/components/breakdown";
import { ModuleGroup, OTHER_STUDY_COLOR } from "@/lib/study-analytics";
import { StudySession, formatDuration, moduleName, studiedSeconds, whatLabel } from "@/lib/study-sessions";
import { StudyData } from "./use-study";

interface StudySessionsPanelProps {
  sessions: StudySession[]; // this month's finished sessions
  groups: ModuleGroup[];
  study: StudyData;
  onEdit: (session: StudySession) => void;
}

const INITIAL_ROWS = 8;
const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3.5";

// What opens under Study's Total Hours card: hours by module, then the
// sessions themselves (newest first) with edit. Same look as Work's.
export function StudySessionsPanel({ sessions, groups, study, onEdit }: StudySessionsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const newest = [...sessions].reverse();
  const rows = showAll ? newest : newest.slice(0, INITIAL_ROWS);
  const labelOf = (s: StudySession) => `${moduleName(s.module_id, study.modules)} · ${whatLabel(s, study.materials, study.deadlines)}`;

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-7 md:gap-10">
        <div>
          <p className={labelClass}>By module</p>
          <Breakdown
            items={groups.map((g) => ({ label: g.name, value: g.hours, color: g.color }))}
            format={(v) => `${v.toFixed(1)}h`}
          />
        </div>

        <div className="flex flex-col">
          <p className={labelClass}>Sessions</p>
          {sessions.length === 0 && (
            <p className="text-[13px] text-muted-foreground/60 py-2">No study logged this month yet.</p>
          )}
          <div>
            {rows.map((s) => {
              const start = new Date(s.started_at);
              const end = s.ended_at ? new Date(s.ended_at) : start;
              const color = study.modules.find((m) => m.id === s.module_id)?.color ?? OTHER_STUDY_COLOR;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[8px_minmax(0,1fr)_auto_28px] gap-3 items-center py-2.5 text-[13px] border-t border-white/5 first:border-t-0"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-white">{labelOf(s)}</span>
                    <span className="block text-[11px] text-muted-foreground/50 tabular-nums mt-0.5">
                      {format(start, "EEE d MMM")} · {format(start, "HH:mm")}–{format(end, "HH:mm")}
                    </span>
                  </span>
                  <span className="tabular-nums text-white">{formatDuration(studiedSeconds(s))}</span>
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    aria-label={`Edit ${labelOf(s)} session`}
                    title="Edit"
                    className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          {sessions.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="self-start pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
            >
              {showAll ? "Show less" : `Show all ${sessions.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
