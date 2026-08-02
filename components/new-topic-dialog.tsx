"use client";

import React, { useState } from "react";
import { ContextType, Topic } from "@/lib/types";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";

interface NewTopicDialogProps {
  contextName: ContextType;
  onTopicAdded: (topic: Topic) => void;
}

const COLORS = [
  { name: "Purple", class: "bg-purple-500", shadow: "shadow-[0_0_10px_rgba(168,85,247,0.2)]" },
  { name: "Blue", class: "bg-blue-500", shadow: "shadow-[0_0_10px_rgba(59,130,246,0.2)]" },
  { name: "Emerald", class: "bg-emerald-500", shadow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
  { name: "Amber", class: "bg-amber-500", shadow: "shadow-[0_0_10px_rgba(245,158,11,0.2)]" },
  { name: "Rose", class: "bg-rose-500", shadow: "shadow-[0_0_10px_rgba(244,63,94,0.2)]" },
  { name: "Cyan", class: "bg-cyan-500", shadow: "shadow-[0_0_10px_rgba(6,182,212,0.2)]" },
];

export function NewTopicDialog({ contextName, onTopicAdded }: NewTopicDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].class);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tag.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

      const newTopic = {
        title: title.trim(),
        context: contextName,
        tag: tag.trim(),
        color: selectedColor,
        repetition: 0,
        interval: 1, // First review in 1 day
        ease_factor: 2.5,
        next_review_date: tomorrow,
      };

      const { data, error } = await supabase.from("study_topics").insert([newTopic]).select().single();
      if (error) throw error;
      
      onTopicAdded(data as Topic);
      setIsOpen(false);
      setTitle("");
      setTag("");
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
        className="w-8 h-8 rounded-full border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center mt-2 mx-auto cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Add Topic for {contextName}</span>
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
                placeholder="What topic did you learn?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
                disabled={isSubmitting}
              />

              <div className="flex flex-col gap-5">
                
                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Tag (e.g. Geometry, Calculus)
                  </label>
                  <input 
                    type="text"
                    placeholder="Subject Tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="bg-transparent border-b border-white/5 pb-2 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all w-full"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
                    Tag Color
                  </label>
                  <div className="flex gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.class)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all cursor-pointer",
                          c.class,
                          selectedColor === c.class ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                        )}
                      />
                    ))}
                  </div>
                </div>

              </div>

              <div className="mt-2 flex justify-end">
                <button 
                  type="submit"
                  disabled={!title.trim() || !tag.trim() || isSubmitting}
                  className="px-6 py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                >
                  Create Topic
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
