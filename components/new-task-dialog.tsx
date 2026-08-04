"use client";

import React, { useState } from "react";
import { ContextType, Task } from "@/lib/types";
import { Plus, X, Flag, Repeat } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { DatePicker } from "./ui/date-picker";
import { ColorPicker } from "./ui/color-picker";

const COLORS = [
  { name: "Purple", class: "bg-purple-500" },
  { name: "Blue", class: "bg-blue-500" },
  { name: "Emerald", class: "bg-emerald-500" },
  { name: "Amber", class: "bg-amber-500" },
  { name: "Rose", class: "bg-rose-500" },
  { name: "Cyan", class: "bg-cyan-500" },
  { name: "Zinc", class: "bg-zinc-500" },
];

interface NewTaskDialogProps {
  contextName: ContextType;
  selectedDateString: string; // "yyyy-MM-dd"
  onTaskAdded: (task: Task) => void;
  domain?: "WORK" | "STUDY" | "CONTENT" | null;
  trigger?: React.ReactNode;
}

export function NewTaskDialog({ contextName, selectedDateString, onTaskAdded, domain, trigger }: NewTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  const [trackProgress, setTrackProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newTask = {
        title: title.trim(),
        context: contextName,
        status: "todo",
        scheduled_date: selectedDateString,
        due_date: dueDate,
        project: project.trim() || null,
        color: color,
        description: description.trim() || null,
        is_daily: isDaily,
        track_progress: trackProgress,
        progress: 0,
        domain: domain || "WORK",
      };

      const { data, error } = await supabase.from("tasks").insert([newTask]).select().single();
      if (error) throw error;
      
      onTaskAdded(data as Task);
      setIsOpen(false);
      setTitle("");
      setDescription("");
      setDueDate(null);
      setProject("");
      setColor(null);
      setIsDaily(false);
      setTrackProgress(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)} className="cursor-pointer">
        {trigger ? trigger : (
          <div className="w-8 h-8 rounded-full border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center mt-2 mx-auto">
            <Plus className="w-4 h-4" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Modal */}
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            {/* Top decorative gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Add to {contextName}</span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
              
              {/* Title Input */}
              <input 
                type="text" 
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
                disabled={isSubmitting}
              />

              {/* Deadline & Notes Grid */}
              <div className="flex flex-col gap-5">
                
                {/* Project Tag (Only in WORK domain) */}
                {domain === "WORK" && (
                  <>
                  <div className="flex flex-col gap-2 group">
                    <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                      Project Tag
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Reselling, Drink Idea..."
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      className="bg-transparent border-b border-white/5 pb-2 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all w-full"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
                      Color
                    </label>
                    <ColorPicker 
                      selectedColor={color}
                      onChange={setColor}
                      contextName={contextName}
                    />
                  </div>
                </>
                )}

                {/* Deadline */}
                <div className="flex flex-col gap-2 group relative">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 flex items-center gap-2 group-focus-within:text-white/60 transition-colors">
                    Deadline
                  </label>
                  <DatePicker 
                    value={dueDate} 
                    onChange={setDueDate} 
                    icon={<Flag className="w-3 h-3 text-muted-foreground" />}
                    placeholder="Select Date"
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Notes
                  </label>
                  <textarea 
                    placeholder="Optional details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="bg-transparent border-b border-white/5 pb-2 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all resize-none w-full"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Daily Toggle */}
                <div className="flex items-center justify-between group py-2">
                  <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                    <Repeat className="w-3 h-3" />
                    <span className="text-[9px] uppercase tracking-widest font-semibold">
                      Daily Routine
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDaily(!isDaily)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-colors relative",
                      isDaily ? "bg-white" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                      isDaily ? "left-[18px] bg-black" : "left-0.5 bg-white/50"
                    )} />
                  </button>
                </div>

                {/* Progress Toggle */}
                <div className="flex items-center justify-between group py-2">
                  <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                    <span className="text-[9px] uppercase tracking-widest font-semibold">
                      Track Progress
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrackProgress(!trackProgress)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-colors relative",
                      trackProgress ? "bg-white" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                      trackProgress ? "left-[18px] bg-black" : "left-0.5 bg-white/50"
                    )} />
                  </button>
                </div>

              </div>

              {/* Action Button */}
              <div className="mt-2 flex justify-end">
                <button 
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-6 py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
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
