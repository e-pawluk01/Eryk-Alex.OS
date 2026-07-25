"use client";

import React, { useState } from "react";
import { Goal } from "@/lib/types";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface NewGoalDialogProps {
  onGoalAdded: (goal: Goal) => void;
  currentDomain: string;
}

export function NewGoalDialog({ onGoalAdded, currentDomain }: NewGoalDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newGoal = {
        title: title.trim(),
        context: currentDomain,
        year,
        status: "active"
      };

      const { data, error } = await supabase.from("goals").insert([newGoal]).select().single();
      if (error) throw error;
      
      onGoalAdded(data as Goal);
      setIsOpen(false);
      setTitle("");
      setYear(new Date().getFullYear());
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-4 border border-dashed border-border rounded-lg text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors group min-w-[280px]"
      >
        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        <span className="text-xs uppercase tracking-widest font-semibold">New Goal</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg overflow-visible shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Set New Goal</span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
              
              <input 
                type="text" 
                placeholder="Goal title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
                disabled={isSubmitting}
              />

              <div className="flex flex-col gap-5">
                
                <div className="flex flex-col gap-2 group relative">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 flex items-center gap-2 group-focus-within:text-white/60 transition-colors">
                    Year
                  </label>
                  <input 
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="bg-transparent border-b border-white/5 pb-2 text-sm text-white focus:outline-none focus:border-white/30 transition-all font-mono"
                    disabled={isSubmitting}
                  />
                </div>

              </div>

              <div className="mt-2 flex justify-end">
                <button 
                  type="submit"
                  disabled={!title.trim() || !year || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black py-3 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  Create
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
