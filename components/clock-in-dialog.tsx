"use client";

import React, { useState } from "react";
import { X, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useGlobalContext } from "./global-context";

const TASKS = [
  "Sourcing",
  "Cleaning / Restoration",
  "Photography",
  "Listing",
  "Packing / Shipping",
  "Admin",
  "Other"
];

interface ClockInDialogProps {
  onSessionStarted: () => void;
  trigger?: React.ReactNode;
}

export function ClockInDialog({ onSessionStarted, trigger }: ClockInDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [task, setTask] = useState(TASKS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userEmail } = useGlobalContext();

  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("work_sessions").insert([
        {
          person: userContextName,
          task: task,
          // started_at defaults to NOW() in DB
        }
      ]);
      if (error) throw error;
      
      onSessionStarted();
      setIsOpen(false);
    } catch (err: any) {
      console.error("Failed to clock in", err);
      alert(err.message || "Failed to clock in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors">
            <Play className="w-3 h-3" />
            Clock In
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Start Work Session</span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
                  Select Task
                </label>
                <select
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-white/30 transition-colors appearance-none"
                >
                  {TASKS.map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSubmitting ? "Starting..." : "Begin Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
