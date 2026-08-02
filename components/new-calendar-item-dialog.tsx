"use client";

import React, { useState } from "react";
import { ContextType, Task, Event } from "@/lib/types";
import { X, Calendar, Clock, Flag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { DatePicker } from "./ui/date-picker";
import { TimePicker } from "./ui/time-picker";

interface NewCalendarItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contextName: ContextType;
  domainName: "WORK" | "STUDY" | "CONTENT";
  selectedDateString: string; // "yyyy-MM-dd"
  onTaskAdded: (task: Task) => void;
  onEventAdded: (event: Event) => void;
}

export function NewCalendarItemDialog({ isOpen, onClose, contextName, domainName, selectedDateString, onTaskAdded, onEventAdded }: NewCalendarItemDialogProps) {
  const [type, setType] = useState<"task" | "event">("task");
  const [title, setTitle] = useState("");
  const [timeOrDeadline, setTimeOrDeadline] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (type === "task") {
        const newTask = {
          title: title.trim(),
          context: contextName,
          domain: domainName,
          status: "todo",
          scheduled_date: selectedDateString,
          due_date: timeOrDeadline || null,
          description: description.trim() || null,
        };
        const { data, error } = await supabase.from("tasks").insert([newTask]).select().single();
        if (error) throw error;
        onTaskAdded(data as Task);
      } else {
        const newEvent = {
          title: title.trim(),
          context: contextName,
          domain: domainName,
          event_date: selectedDateString,
          event_time: timeOrDeadline || null,
          description: description.trim() || null,
        };
        const { data, error } = await supabase.from("events").insert([newEvent]).select().single();
        if (error) throw error;
        onEventAdded(data as Event);
      }
      
      onClose();
      setTitle("");
      setTimeOrDeadline("");
      setDescription("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
        
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex bg-white/5 p-1 rounded-md text-[10px] uppercase tracking-widest font-semibold">
            <button
              type="button"
              onClick={() => { setType("task"); setTimeOrDeadline(null); }}
              className={cn("px-3 py-1.5 rounded transition-colors", type === "task" ? "bg-white text-black" : "text-muted-foreground hover:text-white")}
            >
              Task
            </button>
            <button
              type="button"
              onClick={() => { setType("event"); setTimeOrDeadline(null); }}
              className={cn("px-3 py-1.5 rounded transition-colors", type === "event" ? "bg-white text-black" : "text-muted-foreground hover:text-white")}
            >
              Event
            </button>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
          
          <input 
            type="text" 
            placeholder="Title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
            disabled={isSubmitting}
          />

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 group relative">
              <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 flex items-center gap-2 group-focus-within:text-white/60 transition-colors">
                {type === "task" ? "Deadline (Optional)" : "Time (Optional)"}
              </label>
              
              {type === "task" ? (
                <DatePicker 
                  value={timeOrDeadline} 
                  onChange={setTimeOrDeadline} 
                  icon={<Flag className="w-3 h-3 text-muted-foreground" />}
                  placeholder="Select Date"
                />
              ) : (
                <TimePicker 
                  value={timeOrDeadline} 
                  onChange={setTimeOrDeadline} 
                  icon={<Clock className="w-3 h-3 text-muted-foreground" />}
                  placeholder="Select Time"
                />
              )}
            </div>

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
          </div>

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
  );
}
