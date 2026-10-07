"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, History, Square } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { openSessionOf, notifySessionsChanged, WorkSession } from "@/lib/work-sessions";
import {
  StudySession, STUDY_CHANGED_EVENT, OTHER, missingText, moduleName, openStudySessionOf, sessionFields, startRinging, whatLabel,
} from "@/lib/study-sessions";
import { SessionFormDialog } from "@/components/session-form-dialog";
import { StudyData } from "./use-study";
import { ModuleDot, primaryButton, StudyModal } from "./bits";
import { ModuleAndWhat, PromptDialog, StudyClockOutDialog, StudyMissedDialog, initialChoice } from "./study-clock-dialogs";

const formatTime = (total: number) => {
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
const durTxt = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};
// Remembers which sessions have already rung, so a reload doesn't ring again.
const rungKey = (id: string) => `study-timer-rung-${id}`;
const hasRung = (id: string) => { try { return localStorage.getItem(rungKey(id)) === "1"; } catch { return false; } };
const markRung = (id: string) => { try { localStorage.setItem(rungKey(id), "1"); } catch { /* optional */ } };

/**
 * Study clock, bottom right. Stays mounted in Work too (hidden) so a timer
 * still rings there; the pill only shows in Study.
 */
export function StudyClock({ study, visible }: { study: StudyData; visible: boolean }) {
  const person = study.person;
  const [active, setActive] = useState<StudySession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startModule, setStartModule] = useState<string | null>(null);
  const [workClash, setWorkClash] = useState<{ session: WorkSession; then: () => void } | null>(null);
  const [workCheckout, setWorkCheckout] = useState<{ session: WorkSession; then: () => void } | null>(null);
  const [ringing, setRinging] = useState(false);
  const [checkingOut, setCheckingOut] = useState<null | "stop" | "switch">(null);
  const [missed, setMissed] = useState<{ module: string; what: string; other: string } | null>(null);
  const stopRinging = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    if (!person) return;
    setActive(await openStudySessionOf(person));
    setLoaded(true);
  }, [person]);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(STUDY_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(STUDY_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  // Tick the clock, and ring once when the timer runs out.
  const ringRef = useRef<() => void>(() => {});
  ringRef.current = () => {
    if (!active || hasRung(active.id)) return;
    markRung(active.id);
    stopRinging.current = startRinging();
    const what = whatLabel(active, study.materials, study.deadlines);
    const time = durTxt(active.timer_minutes ?? 0);
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification("Time to switch", { body: `${time} on ${what} is up.`, tag: `study-timer-${active.id}`, requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch { /* notifications are optional */ }
    setRinging(true);
  };
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const start = new Date(active.started_at).getTime();
    const tick = () => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      if (active.timer_minutes && secs >= active.timer_minutes * 60) ringRef.current();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // While ringing, the tab title flashes too, in case the app is in the background.
  useEffect(() => {
    if (!ringing) return;
    const original = document.title;
    let flip = false;
    const t = setInterval(() => { flip = !flip; document.title = flip ? "Time to switch" : original; }, 1000);
    return () => { clearInterval(t); document.title = original; };
  }, [ringing]);

  const dismissRing = () => { stopRinging.current(); setRinging(false); };
  useEffect(() => () => stopRinging.current(), []);

  // Starting: if Work is running, ask first; clocking out of Work then starts Study.
  const begin = async (moduleId: string, what: string, otherText: string, timerMinutes: number | null) => {
    if (!person) return;
    const run = async () => {
      const { error } = await supabase.from("study_sessions").insert({
        person,
        ...sessionFields(moduleId, what, otherText),
        started_at: new Date().toISOString(),
        timer_minutes: timerMinutes,
      });
      if (error) { console.error("Failed to start studying:", error); return; }
      setStarting(false);
      refresh();
    };
    const work = await openSessionOf(person);
    if (work) setWorkClash({ session: work, then: run });
    else run();
  };

  const afterClockOut = () => {
    const mode = checkingOut;
    const mod = active ? active.module_id ?? OTHER : null;
    setCheckingOut(null);
    setActive(null);
    if (mode === "switch") { setStartModule(mod); setStarting(true); }
  };

  if (!person || !loaded) return null;
  const module = active ? study.modules.find(m => m.id === active.module_id) : undefined;
  const timerLeft = active?.timer_minutes ? Math.max(0, active.timer_minutes * 60 - elapsed) : null;

  return (
    <>
      {visible && createPortal(
        !active ? (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button
              onClick={() => { setStartModule(null); setStarting(true); }}
              aria-label="Start studying"
              className="p-4 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-2xl hover:bg-white/10 transition-colors group"
            >
              <Clock className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          </div>
        ) : (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 pl-5 pr-2 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <ModuleDot module={module} />
              <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 hidden md:block mt-px max-w-[220px] truncate">
                {moduleName(active.module_id, study.modules)} · {whatLabel(active, study.materials, study.deadlines)}
              </span>
              <span className="text-sm font-semibold tracking-wider text-white font-mono min-w-[60px] text-center">{formatTime(elapsed)}</span>
              {timerLeft !== null && <span className="text-[11px] font-mono text-white/40 tabular-nums">{formatTime(timerLeft)} left</span>}
            </div>
            <button
              onClick={() => setCheckingOut("stop")}
              aria-label="Clock out"
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
            >
              <Square className="w-4 h-4 text-white/60 group-hover:text-white fill-current transition-colors" />
            </button>
          </div>
        ),
        document.body
      )}

      {starting && (
        <StartStudyDialog
          study={study}
          initialModule={startModule}
          onClose={() => setStarting(false)}
          onBegin={begin}
          onAddMissed={(mod, what, other) => { setStarting(false); setMissed({ module: mod, what, other }); }}
        />
      )}

      {workClash && (
        <PromptDialog
          icon="clock"
          stacked
          title="You're clocked into Work"
          detail={`${workClash.session.task} · ${formatTime(Math.floor((Date.now() - new Date(workClash.session.started_at).getTime()) / 1000))}. Clock out of Work and start studying?`}
          confirmLabel="Clock out of Work"
          cancelLabel="Cancel"
          onConfirm={() => { setWorkCheckout(workClash); setWorkClash(null); }}
          onCancel={() => setWorkClash(null)}
        />
      )}

      {workCheckout && (
        <SessionFormDialog
          mode="clockout"
          session={workCheckout.session}
          person={person}
          onClose={() => setWorkCheckout(null)}
          onSaved={() => { const then = workCheckout.then; setWorkCheckout(null); notifySessionsChanged(); then(); }}
        />
      )}

      {ringing && active && (
        <PromptDialog
          icon="bell"
          mustChoose
          title={`${durTxt(active.timer_minutes ?? 0)} on ${whatLabel(active, study.materials, study.deadlines)} is up`}
          detail="Time to switch to something else."
          confirmLabel="Switch"
          cancelLabel="Keep going"
          onConfirm={() => { dismissRing(); setCheckingOut("switch"); }}
          onCancel={dismissRing}
        />
      )}

      {checkingOut && active && (
        <StudyClockOutDialog session={active} onClose={() => setCheckingOut(null)} onSaved={afterClockOut} />
      )}

      {missed && <StudyMissedDialog study={study} initialModule={missed.module} initialWhat={missed.what} initialOther={missed.other} onClose={() => setMissed(null)} />}
    </>
  );
}

function StartStudyDialog({ study, initialModule, onClose, onBegin, onAddMissed }: {
  study: StudyData;
  initialModule: string | null;
  onClose: () => void;
  onBegin: (moduleId: string, what: string, otherText: string, timerMinutes: number | null) => Promise<void>;
  onAddMissed: (moduleId: string, what: string, otherText: string) => void;
}) {
  const start = initialChoice(study, initialModule);
  const [moduleId, setModuleId] = useState(start.moduleId);
  const [what, setWhat] = useState(start.what);
  const [otherText, setOtherText] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [starting, setStarting] = useState(false);
  const timer = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const handleBegin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (starting || missingText(moduleId, what, otherText)) return;
    setStarting(true);
    // Ask for notification permission now, while it's a direct click.
    if (timer > 0 && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* optional */ }
    }
    await onBegin(moduleId, what, otherText, timer > 0 ? timer : null);
    setStarting(false);
  };

  const numberBox = "w-16 text-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/30 font-mono tabular-nums";

  return createPortal(
    <StudyModal title="Start Study Session" onClose={onClose}>
      <form onSubmit={handleBegin} className="flex flex-col gap-6">
        <ModuleAndWhat study={study} moduleId={moduleId} what={what} otherText={otherText} onModule={setModuleId} onWhat={setWhat} onOtherText={setOtherText} />
        <details className="border-t border-white/[0.06] pt-4 group">
          <summary className="flex justify-between text-[12.5px] text-muted-foreground group-open:text-white group-open:mb-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Timer <span className="font-medium text-white/40">{timer ? durTxt(timer) : "Off"}</span>
          </summary>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder="0" value={hours} onChange={e => setHours(e.target.value.replace(/\D/g, "").slice(0, 2))} className={numberBox} aria-label="Timer hours" />
            <span className="text-xs text-muted-foreground">h</span>
            <input type="text" inputMode="numeric" placeholder="0" value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 2))} className={numberBox} aria-label="Timer minutes" />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </details>
        <div className="flex flex-col gap-2 pt-2">
          <button type="submit" disabled={starting || missingText(moduleId, what, otherText)} className={primaryButton}>{starting ? "Starting..." : "Begin Session"}</button>
          <button
            type="button"
            onClick={() => onAddMissed(moduleId, what, otherText)}
            className="w-full py-3 flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/10 text-white/75 hover:text-white border border-white/10 font-bold uppercase tracking-widest text-[10px] rounded-lg transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Add Missed Session
          </button>
        </div>
      </form>
    </StudyModal>,
    document.body
  );
}
