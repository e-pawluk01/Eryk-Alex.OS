"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobalContext } from "./global-context";
import { ClockInDialog } from "./clock-in-dialog";
import { Square, Timer, Loader2 } from "lucide-react";

export function ActiveSessionWidget({ onHoursUpdated }: { onHoursUpdated?: () => void }) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const { userEmail } = useGlobalContext();
  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";

  const fetchActiveSession = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      const start = new Date(activeSession.started_at).getTime();
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleClockOut = async () => {
    if (!activeSession || isClockingOut) return;
    setIsClockingOut(true);
    try {
      const endedAt = new Date().toISOString();
      const duration = elapsedSeconds;

      const { error } = await supabase
        .from("work_sessions")
        .update({ ended_at: endedAt, duration })
        .eq("id", activeSession.id);

      if (error) throw error;
      
      setActiveSession(null);
      setElapsedSeconds(0);
      if (onHoursUpdated) onHoursUpdated();
    } catch (err) {
      console.error("Failed to clock out", err);
      alert("Failed to clock out. Please try again.");
    } finally {
      setIsClockingOut(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground/50 h-10">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-[10px] uppercase tracking-widest font-semibold">Checking status...</span>
      </div>
    );
  }

  if (!activeSession) {
    return <ClockInDialog onSessionStarted={fetchActiveSession} />;
  }

  return (
    <div className="flex items-center justify-between bg-[#111] border border-white/10 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 w-full md:w-auto md:min-w-[300px]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          <Timer className="w-4 h-4 text-white/80 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Working: {activeSession.task}</span>
          <span className="text-sm font-semibold tracking-wider text-white">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      <button 
        onClick={handleClockOut}
        disabled={isClockingOut}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-50"
      >
        {isClockingOut ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Square className="w-3 h-3 fill-current" />
        )}
        Clock Out
      </button>
    </div>
  );
}
