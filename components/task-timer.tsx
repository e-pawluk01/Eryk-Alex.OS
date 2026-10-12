"use client";

import React, { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  StudySession, STUDY_CHANGED_EVENT, openStudySessionOf, requestStudyClockOut, startTaskTimer,
} from "@/lib/study-sessions";

/** The running Study session (if any), kept fresh as sessions start and stop. */
function useOpenStudySession(person: string) {
  const [session, setSession] = useState<StudySession | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => openStudySessionOf(person).then(s => { if (alive) setSession(s); });
    load();
    window.addEventListener(STUDY_CHANGED_EVENT, load);
    return () => { alive = false; window.removeEventListener(STUDY_CHANGED_EVENT, load); };
  }, [person]);
  return session;
}

/** Play / pause and the time bar for a timed Study task (the bar looks like Track Progress's). */
export function TaskTimer({ task, person }: { task: Task; person: string }) {
  const session = useOpenStudySession(person);
  const running = !!session && session.task_id === task.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const limit = (task.time_limit_minutes ?? 0) * 60;
  const live = running ? Math.max(0, (now - new Date(session!.started_at).getTime()) / 1000) : 0;
  const spent = (task.time_spent_seconds ?? 0) + live;
  const pct = task.status === "done" ? 100 : limit ? Math.min(100, (spent / limit) * 100) : 0;
  const done = task.status === "done";

  const press = () => {
    if (running) { requestStudyClockOut(); return; }
    startTaskTimer({ taskId: task.id, title: task.title, minutes: Math.max(1, Math.ceil((limit - spent) / 60)) });
  };

  return (
    <>
      <button
        type="button"
        onClick={press}
        disabled={done}
        aria-label={running ? "Pause" : "Start"}
        className={cn(
          "w-6 h-6 rounded-md grid place-items-center shrink-0 transition-colors",
          done ? "bg-white/15 text-black/60" : "bg-white text-black hover:bg-white/85"
        )}
      >
        {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
      </button>
      <div className="flex-1 min-w-0 h-1.5 bg-white/10 rounded-full relative">
        <div className="absolute left-0 top-0 bottom-0 rounded-full bg-white transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

/** The Time Limit switch's hours and minutes, saved as you type. */
export function TimeLimitFields({ minutes, onChange }: { minutes: number | null; onChange: (minutes: number | null) => void }) {
  const [hours, setHours] = useState(minutes ? String(Math.floor(minutes / 60)) : "");
  const [mins, setMins] = useState(minutes ? String(minutes % 60) : "");
  const save = (h: string, m: string) => {
    const total = (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
    if (total > 0) onChange(total);
  };
  const box = "w-14 bg-black/40 border border-white/10 rounded-lg px-1 py-2 text-sm text-center text-white/90 tabular-nums outline-none focus:border-white/30 transition-colors";
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground -mt-2">
      <input
        inputMode="numeric"
        aria-label="Hours"
        value={hours}
        onFocus={e => e.target.select()}
        onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); setHours(v); save(v, mins); }}
        className={box}
      />
      h
      <input
        inputMode="numeric"
        aria-label="Minutes"
        value={mins}
        onFocus={e => e.target.select()}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
          const v = raw === "" ? "" : String(Math.min(59, Number(raw)));
          setMins(v); save(hours, v);
        }}
        className={box}
      />
      m
    </span>
  );
}
