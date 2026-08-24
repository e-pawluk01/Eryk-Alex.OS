"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobalContext } from "./global-context";
import { ClockInDialog } from "./clock-in-dialog";
import { Square, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return null;
  }

  if (!activeSession) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 pl-5 pr-2 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[9px] uppercase tracking-widest font-bold text-white/50 hidden md:block mt-px">
          {activeSession.task}
        </span>
        <span className="text-sm font-semibold tracking-wider text-white font-mono w-[60px] text-center">
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      <button 
        onClick={handleClockOut}
        disabled={isClockingOut}
        className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-colors disabled:opacity-50 group"
      >
        {isClockingOut ? (
          <Loader2 className="w-4 h-4 animate-spin text-white/80" />
        ) : (
          <Square className="w-4 h-4 text-white/60 group-hover:text-white fill-current transition-colors" />
        )}
      </button>
    </div>
  );
}
