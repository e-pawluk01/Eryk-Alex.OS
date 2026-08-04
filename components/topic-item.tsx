"use client";

import React, { useState } from "react";
import { Topic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { differenceInDays, startOfDay, addDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Loader2, Clock } from "lucide-react";
import { EditTopicDialog } from "./edit-topic-dialog";

interface TopicItemProps {
  topic: Topic;
  onUpdate: (id: string, updates: Partial<Topic>) => void;
  onDelete: (id: string) => void;
}

export function TopicItem({ topic, onUpdate, onDelete }: TopicItemProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = startOfDay(new Date());
  const reviewDate = startOfDay(new Date(topic.next_review_date));
  const daysDiff = differenceInDays(reviewDate, today);
  const isDue = daysDiff <= 0;

  const handleReview = async (grade: "hard" | "good" | "easy") => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let newInterval = topic.interval;
      let newEase = topic.ease_factor;

      if (grade === "hard") {
        newInterval = 1;
        newEase = Math.max(1.3, newEase - 0.2);
      } else if (grade === "good") {
        newInterval = Math.max(2, Math.round(newInterval * newEase));
      } else if (grade === "easy") {
        newInterval = newInterval <= 1 ? 4 : newInterval + 4;
        newEase += 0.15;
      }

      const nextReviewDate = format(addDays(today, newInterval), "yyyy-MM-dd");

      const updates = {
        interval: newInterval,
        ease_factor: newEase,
        repetition: topic.repetition + 1,
        next_review_date: nextReviewDate,
      };

      // Optimistic update
      onUpdate(topic.id, updates);
      await supabase.from("study_topics").update(updates).eq("id", topic.id);
    } catch (error) {
      console.error("Failed to update topic:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  let statusText = "";
  if (daysDiff < 0) statusText = `${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? 'day' : 'days'} overdue`;
  else if (daysDiff === 0) statusText = "Due today";
  else statusText = `In ${daysDiff} ${daysDiff === 1 ? 'day' : 'days'}`;

  const isHex = topic.color.startsWith('#');

  return (
    <div className="flex flex-col gap-2 p-3 bg-card border border-border rounded-lg group relative overflow-hidden transition-colors hover:border-primary/20">
      <EditTopicDialog topic={topic} onUpdate={onUpdate} onDelete={onDelete} />
      <div className="flex gap-3 relative z-10">
        <div className="pt-0.5">
          <div 
            className={cn("w-4 h-4 rounded-full border flex items-center justify-center opacity-80", !isHex && topic.color.replace("bg-", "border-"))}
            style={isHex ? { borderColor: topic.color } : undefined}
          >
            <div 
              className={cn("w-2 h-2 rounded-full", !isHex && topic.color)} 
              style={isHex ? { backgroundColor: topic.color } : undefined}
            />
          </div>
        </div>
        
        <div className="flex flex-col flex-1 gap-1.5 min-w-0">
          <span className="text-sm font-medium text-foreground line-clamp-1">{topic.title}</span>
          
          <div className="flex items-center gap-2">
            <span 
              className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border shrink-0 bg-white/5 shadow-[0_0_8px_rgba(0,0,0,0.2)]", !isHex && topic.color.replace("bg-", "text-"), !isHex && topic.color.replace("bg-", "border-"))}
              style={isHex ? { color: topic.color, borderColor: `${topic.color}80` } : undefined}
            >
              {topic.tag}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {statusText}
            </span>
          </div>

          {isDue && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button 
                onClick={() => handleReview("hard")}
                disabled={isSubmitting}
                className="flex flex-col items-center justify-center p-1.5 rounded bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors text-[9px] uppercase tracking-widest font-bold disabled:opacity-50 text-white/60"
              >
                Hard
                <span className="text-[8px] mt-0.5 font-medium text-white/20 lowercase tracking-normal">1 day</span>
              </button>
              <button 
                onClick={() => handleReview("good")}
                disabled={isSubmitting}
                className="flex flex-col items-center justify-center p-1.5 rounded bg-white/5 border border-white/10 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/20 transition-colors text-[9px] uppercase tracking-widest font-bold disabled:opacity-50 text-white/60"
              >
                Good
                <span className="text-[8px] mt-0.5 font-medium text-white/20 lowercase tracking-normal">{Math.max(2, Math.round(topic.interval * topic.ease_factor))} days</span>
              </button>
              <button 
                onClick={() => handleReview("easy")}
                disabled={isSubmitting}
                className="flex flex-col items-center justify-center p-1.5 rounded bg-white/5 border border-white/10 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20 transition-colors text-[9px] uppercase tracking-widest font-bold disabled:opacity-50 text-white/60"
              >
                Easy
                <span className="text-[8px] mt-0.5 font-medium text-white/20 lowercase tracking-normal">{topic.interval <= 1 ? 4 : topic.interval + 4} days</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isSubmitting && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
