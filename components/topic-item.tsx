"use client";

import React, { useState } from "react";
import { Topic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { differenceInDays, startOfDay, addDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

interface TopicItemProps {
  topic: Topic;
  onUpdate: (id: string, updates: Partial<Topic>) => void;
}

export function TopicItem({ topic, onUpdate }: TopicItemProps) {
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
  if (daysDiff < 0) statusText = `${Math.abs(daysDiff)}d overdue`;
  else if (daysDiff === 0) statusText = "Due today";
  else statusText = `In ${daysDiff}d`;

  return (
    <div className="flex flex-col gap-3 p-4 bg-card border border-border rounded-lg relative overflow-hidden group">
      
      {/* Background tint based on tag color */}
      <div className={cn("absolute inset-0 opacity-5 pointer-events-none", topic.color)} />

      <div className="flex flex-col gap-1.5 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{topic.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border shrink-0 bg-white/5 border-white/10", topic.color.replace("bg-", "text-"))}>
            {topic.tag}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            {statusText}
          </span>
        </div>
      </div>

      {isDue && (
        <div className="grid grid-cols-3 gap-2 mt-2 z-10">
          <button 
            onClick={() => handleReview("hard")}
            disabled={isSubmitting}
            className="flex items-center justify-center p-2 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors text-[10px] uppercase tracking-widest font-bold disabled:opacity-50"
          >
            Hard <span className="text-red-500/50 ml-1">(1d)</span>
          </button>
          <button 
            onClick={() => handleReview("good")}
            disabled={isSubmitting}
            className="flex items-center justify-center p-2 rounded-md bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-[10px] uppercase tracking-widest font-bold disabled:opacity-50"
          >
            Good <span className="text-orange-500/50 ml-1">({Math.max(2, Math.round(topic.interval * topic.ease_factor))}d)</span>
          </button>
          <button 
            onClick={() => handleReview("easy")}
            disabled={isSubmitting}
            className="flex items-center justify-center p-2 rounded-md bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 transition-colors text-[10px] uppercase tracking-widest font-bold disabled:opacity-50"
          >
            Easy <span className="text-green-500/50 ml-1">({topic.interval <= 1 ? 4 : topic.interval + 4}d)</span>
          </button>
        </div>
      )}

      {isSubmitting && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

    </div>
  );
}
