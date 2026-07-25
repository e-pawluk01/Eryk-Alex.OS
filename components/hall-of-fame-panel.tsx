"use client";

import React from "react";
import { Goal } from "@/lib/types";
import { X, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface HallOfFamePanelProps {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal[];
  onToggleStatus: (id: string, newStatus: "active" | "completed") => void;
}

export function HallOfFamePanel({ isOpen, onClose, goals, onToggleStatus }: HallOfFamePanelProps) {
  
  const completedGoals = goals.filter(g => g.status === "completed").sort((a, b) => b.year - a.year);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col animate-in fade-in duration-500 overflow-hidden">
      
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-yellow-600/10 to-transparent blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-8">
        <div className="w-10" /> {/* Spacer for centering */}
        <div className="flex flex-col items-center">
          <Trophy className="w-12 h-12 text-yellow-500/80 mb-4 animate-in slide-in-from-top-4 duration-700" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 drop-shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-in fade-in zoom-in-95 duration-1000">
            Hall of Goals
          </h1>
          <p className="text-sm tracking-widest text-yellow-500/50 uppercase mt-4 animate-in fade-in duration-1000 delay-300">
            A monument to your achievements
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="w-12 h-12 rounded-full flex items-center justify-center border border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grid of Achievements */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-12 md:px-24 pb-32">
        {completedGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Trophy className="w-24 h-24 mb-8 text-white/10" />
            <p className="text-lg font-medium tracking-widest uppercase">The Hall is Empty</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">Achieve your long-term goals on the dashboard to enshrine them here forever.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {completedGoals.map((goal, i) => (
              <div 
                key={goal.id} 
                className="group relative flex flex-col bg-zinc-900/50 backdrop-blur-md border border-yellow-500/20 rounded-2xl p-8 shadow-2xl hover:border-yellow-500/50 hover:-translate-y-2 transition-all duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Glowing orb behind card */}
                <div className="absolute inset-0 bg-yellow-500/0 group-hover:bg-yellow-500/10 rounded-2xl transition-colors duration-500" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-3xl font-light text-yellow-500/40 font-serif italic">
                      {goal.year}
                    </span>
                    <button
                      onClick={() => onToggleStatus(goal.id, "active")}
                      className="opacity-0 group-hover:opacity-100 text-[10px] uppercase tracking-widest font-bold text-yellow-500/70 hover:text-yellow-400 transition-all bg-yellow-500/10 px-3 py-1.5 rounded-full"
                    >
                      Restore
                    </button>
                  </div>
                  
                  <h3 className="text-xl md:text-2xl font-bold text-white/90 leading-snug mb-8 flex-1 group-hover:text-yellow-100 transition-colors">
                    {goal.title}
                  </h3>
                  
                  <div className="flex justify-between items-center pt-6 border-t border-yellow-500/20 mt-auto">
                    <span className="text-[10px] font-bold text-yellow-500/60 uppercase tracking-widest">
                      Achieved
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
