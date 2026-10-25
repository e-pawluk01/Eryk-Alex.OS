"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobalContext } from "./global-context";
import { ClockInDialog } from "./clock-in-dialog";
import { SessionFormDialog } from "./session-form-dialog";
import { Square, Clock, Pause, Play, Music } from "lucide-react";
import { MusicData } from "./study/use-music";
import { MusicControls } from "./study/study-clock";
import { WorkSession, SESSIONS_CHANGED_EVENT, sessionLabel, togglePauseSession, workedSeconds } from "@/lib/work-sessions";

export function ActiveSessionWidget({ music, onHoursUpdated }: { music: MusicData; onHoursUpdated?: () => void }) {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const { userEmail } = useGlobalContext();
  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";

  // Starts out loading; later re-checks keep the widget on screen.
  const fetchActiveSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("person", userContextName)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }
      
      setActiveSession(data || null);
    } catch (err) {
      console.error("Failed to fetch active session", err);
    } finally {
      setLoading(false);
    }
  }, [userContextName]);

  // Re-check when the app comes back into view or a session is saved: the
  // other person may have started or ended a joint session meanwhile.
  useEffect(() => {
    fetchActiveSession();
    const onVisible = () => { if (document.visibilityState === "visible") fetchActiveSession(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(SESSIONS_CHANGED_EVENT, fetchActiveSession);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, fetchActiveSession);
    };
  }, [fetchActiveSession]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      const tick = () => setElapsedSeconds(Math.floor(workedSeconds(activeSession)));
      interval = setInterval(tick, 1000);
      tick();
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  // Clocking out always goes through the "are these hours correct?" check.
  const handleClockedOut = () => {
    setCheckingOut(false);
    setActiveSession(null);
    setElapsedSeconds(0);
    if (onHoursUpdated) onHoursUpdated();
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return null;
  }

  if (!activeSession) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Music: the same button as Study's, beside the clock */}
        {music.current ? (
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/30 shadow-2xl">
            <MusicControls music={music} size="lg" />
          </div>
        ) : (
          <button
            onClick={() => music.setOpen(!music.open)}
            aria-label="Music"
            className={`p-4 rounded-full bg-zinc-950/80 backdrop-blur-md border shadow-2xl hover:bg-white/10 transition-colors group ${music.open ? "border-white/30" : "border-white/10"}`}
          >
            <Music className={`w-5 h-5 transition-colors ${music.open ? "text-white" : "text-white/70 group-hover:text-white"}`} />
          </button>
        )}
        <ClockInDialog 
          onSessionStarted={fetchActiveSession} 
          trigger={
            <button className="p-4 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-2xl hover:bg-white/10 transition-colors group">
              <Clock className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          }
        />
      </div>
    );
  }

  const paused = !!activeSession.paused_at;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 pl-5 pr-2 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full bg-red-500 ${paused ? "" : "animate-pulse"}`} />
        <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 hidden md:block mt-px">
          {paused ? "Paused" : sessionLabel(activeSession)}
        </span>
        <span className={`text-sm font-semibold tracking-wider font-mono w-[60px] text-center ${paused ? "text-white/40" : "text-white"}`}>
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {music.current ? (
        <div className="flex items-center gap-0.5">
          <MusicControls music={music} size="sm" />
        </div>
      ) : (
        <button
          onClick={() => music.setOpen(!music.open)}
          aria-label="Music"
          className={`p-2.5 rounded-full border transition-colors ${music.open ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10"}`}
        >
          <Music className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={() => togglePauseSession(activeSession)}
        aria-label={paused ? "Resume" : "Pause"}
        title={paused ? "Resume" : "Pause"}
        className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
      >
        {paused
          ? <Play className="w-4 h-4 text-white/60 group-hover:text-white fill-current transition-colors" />
          : <Pause className="w-4 h-4 text-white/60 group-hover:text-white fill-current transition-colors" />}
      </button>

      <button 
        onClick={() => setCheckingOut(true)}
        aria-label="Clock out"
        className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
      >
        <Square className="w-4 h-4 text-white/60 group-hover:text-white fill-current transition-colors" />
      </button>

      {checkingOut && (
        <SessionFormDialog
          mode="clockout"
          session={activeSession}
          person={userContextName}
          onClose={() => setCheckingOut(false)}
          onSaved={handleClockedOut}
        />
      )}
    </div>
  );
}
