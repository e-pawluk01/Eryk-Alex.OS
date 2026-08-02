"use client";

import React, { useState } from "react";
import { Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Loader2, Lightbulb, PenLine, Video as VideoIcon, CheckCircle2 } from "lucide-react";

interface VideoItemProps {
  video: Video;
  onUpdate: (id: string, updates: Partial<Video>) => void;
}

const STAGES = [
  { id: "idea", icon: Lightbulb, label: "Idea", activeColor: "text-yellow-500", hoverColor: "hover:text-yellow-500", activeBg: "bg-yellow-500/10 border-yellow-500/20" },
  { id: "scripting", icon: PenLine, label: "Scripting", activeColor: "text-blue-500", hoverColor: "hover:text-blue-500", activeBg: "bg-blue-500/10 border-blue-500/20" },
  { id: "filming", icon: VideoIcon, label: "Filming", activeColor: "text-red-500", hoverColor: "hover:text-red-500", activeBg: "bg-red-500/10 border-red-500/20" },
  { id: "ready", icon: CheckCircle2, label: "Ready", activeColor: "text-green-500", hoverColor: "hover:text-green-500", activeBg: "bg-green-500/10 border-green-500/20" },
] as const;

export function VideoItem({ video, onUpdate }: VideoItemProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStageChange = async (stage: typeof STAGES[number]["id"]) => {
    if (isSubmitting || stage === video.stage) return;
    setIsSubmitting(true);

    try {
      const updates = { stage };
      // Optimistic update
      onUpdate(video.id, updates);
      await supabase.from("videos").update(updates).eq("id", video.id);
    } catch (error) {
      console.error("Failed to update video stage:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHex = video.color.startsWith('#');
  
  // Find index of current stage to determine which ones to show active vs inactive
  const currentStageIndex = STAGES.findIndex(s => s.id === video.stage);

  return (
    <div className="flex flex-col gap-2 p-3 bg-transparent border border-white/5 rounded-lg group relative overflow-hidden transition-colors hover:border-white/10 hover:bg-white/[0.02]">
      <div className="flex items-center gap-3 relative z-10">
        <div className="shrink-0">
          <div 
            className={cn("w-3 h-3 rounded-full border flex items-center justify-center opacity-80", !isHex && video.color.replace("bg-", "border-"))}
            style={isHex ? { borderColor: video.color } : undefined}
          >
            <div 
              className={cn("w-1.5 h-1.5 rounded-full", !isHex && video.color)} 
              style={isHex ? { backgroundColor: video.color } : undefined}
            />
          </div>
        </div>
        
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-medium text-white/90 line-clamp-1">{video.title}</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40">{video.tag}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-4">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = idx <= currentStageIndex;
            return (
              <button 
                key={stage.id}
                onClick={() => handleStageChange(stage.id)}
                disabled={isSubmitting}
                title={stage.label}
                className={cn(
                  "flex items-center justify-center p-1.5 rounded-full transition-all",
                  isActive 
                    ? "bg-transparent"
                    : "bg-transparent hover:bg-white/5",
                  "disabled:opacity-50"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? stage.activeColor : "text-white/20 hover:text-white/40"
                )} />
              </button>
            );
          })}
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
