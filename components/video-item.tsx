"use client";

import React, { useState } from "react";
import { Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Loader2, Lightbulb, PenLine, Video as VideoIcon, Scissors } from "lucide-react";

interface VideoItemProps {
  video: Video;
  onUpdate: (id: string, updates: Partial<Video>) => void;
}

const STAGES = [
  { id: "idea", icon: Lightbulb, label: "Idea", activeColor: "text-yellow-500", hoverColor: "hover:text-yellow-500", activeBg: "bg-yellow-500/10 border-yellow-500/20" },
  { id: "scripting", icon: PenLine, label: "Scripting", activeColor: "text-blue-500", hoverColor: "hover:text-blue-500", activeBg: "bg-blue-500/10 border-blue-500/20" },
  { id: "filming", icon: VideoIcon, label: "Filming", activeColor: "text-red-500", hoverColor: "hover:text-red-500", activeBg: "bg-red-500/10 border-red-500/20" },
  { id: "editing", icon: Scissors, label: "Editing", activeColor: "text-purple-500", hoverColor: "hover:text-purple-500", activeBg: "bg-purple-500/10 border-purple-500/20" },
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
    <div className="flex flex-col gap-2 p-3 bg-card border border-border rounded-lg group relative overflow-hidden transition-colors hover:border-primary/20">
      <div className="flex gap-3 relative z-10">
        <div className="pt-0.5">
          <div 
            className={cn("w-4 h-4 rounded-full border flex items-center justify-center opacity-80", !isHex && video.color.replace("bg-", "border-"))}
            style={isHex ? { borderColor: video.color } : undefined}
          >
            <div 
              className={cn("w-2 h-2 rounded-full", !isHex && video.color)} 
              style={isHex ? { backgroundColor: video.color } : undefined}
            />
          </div>
        </div>
        
        <div className="flex flex-col flex-1 gap-1.5 min-w-0">
          <span className="text-sm font-medium text-foreground line-clamp-1">{video.title}</span>
          
          <div className="flex items-center gap-2">
            <span 
              className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border shrink-0 bg-white/5 shadow-[0_0_8px_rgba(0,0,0,0.2)]", !isHex && video.color.replace("bg-", "text-"), !isHex && video.color.replace("bg-", "border-"))}
              style={isHex ? { color: video.color, borderColor: `${video.color}80` } : undefined}
            >
              {video.tag}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-2">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = idx === currentStageIndex;
              return (
                <button 
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  disabled={isSubmitting}
                  title={stage.label}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded transition-all",
                    isActive 
                      ? cn("border", stage.activeBg)
                      : "bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10",
                    "disabled:opacity-50 group/btn"
                  )}
                >
                  <Icon className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? stage.activeColor : cn("text-white/30", stage.hoverColor)
                  )} />
                </button>
              );
            })}
          </div>
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
