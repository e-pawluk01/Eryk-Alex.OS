"use client";

import React, { useState } from "react";
import { Task } from "@/lib/types";
import { CustomCheckbox } from "./ui/custom-checkbox";
import { cn } from "@/lib/utils";
import { differenceInDays, startOfDay } from "date-fns";
import { Pin, Repeat, Users } from "lucide-react";
import { ProgressSlider } from "./ui/progress-slider";
import { TagChip } from "./tags/tags";

interface TaskItemProps {
  task: Task;
  onToggleStatus: (id: string, newStatus: "todo" | "done") => void;
  onSelect?: (task: Task) => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  noTick?: boolean; // Kanban cards: the column says whether it's done
}

export function TaskItem({ task, onToggleStatus, onSelect, onUpdate, noTick }: TaskItemProps) {

  let daysLeftText = "";
  let colorClass = "text-muted-foreground";
  let dotClass = "";

  if (task.due_date) {
    const days = differenceInDays(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
    if (days < 0) daysLeftText = `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    else if (days === 0) daysLeftText = "Due today";
    else daysLeftText = `${days} day${days === 1 ? '' : 's'} left`;

    if (task.status !== "done") {
      if (days <= 1) {
        colorClass = "text-red-500/80";
        dotClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse";
      } else if (days <= 3) {
        colorClass = "text-orange-500/80";
        dotClass = "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]";
      } else if (days <= 7) {
        colorClass = "text-green-500/80";
        dotClass = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]";
      } else {
        // > 7 days, neutral appearance
        colorClass = "text-muted-foreground/60";
        dotClass = "bg-muted-foreground/20";
      }
    } else {
      colorClass = "text-muted-foreground/30";
      dotClass = ""; // no dot for done tasks
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div 
        className={cn(
          "flex items-start gap-4 p-4 group hover:bg-white/[0.02] transition-colors rounded-lg cursor-pointer relative overflow-hidden border border-transparent",
          task.status === "done" && "opacity-50"
        )}
        onClick={(e) => {
          // Prevent opening panel if clicking checkbox
          if (onSelect) onSelect(task);
        }}
      >
        {!noTick && (
          <div className="pt-0.5 relative z-10" onClick={e => e.stopPropagation()}>
            <CustomCheckbox 
              checked={task.status === "done"} 
              onChange={(checked) => onToggleStatus(task.id, checked ? "done" : "todo")} 
            />
          </div>
        )}
        
        <div className="flex flex-col flex-1 gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm font-medium transition-colors line-clamp-1",
              task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {task.title}
            </span>
            <TagChip tagId={task.tag_id} />
            {task.is_daily && (
              <Repeat className="w-3 h-3 text-muted-foreground ml-1" />
            )}
            {task.is_joint && (
              <Users className="w-3 h-3 text-blue-400 ml-1" />
            )}
          </div>
          {task.description?.trim() && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Open for notes
            </p>
          )}
          {/* Timed Study task: the same bar as Track Progress, filled by time clocked */}
          {task.domain === "STUDY" && !!task.time_limit_minutes && (
            <div className="w-full h-1.5 bg-white/10 rounded-full relative mt-3 mb-1">
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full bg-white"
                style={{ width: `${task.status === "done" ? 100 : Math.min(100, ((task.time_spent_seconds ?? 0) / (task.time_limit_minutes * 60)) * 100)}%` }}
              />
            </div>
          )}
          {task.track_progress && !(task.domain === "STUDY" && task.time_limit_minutes) && (
            <ProgressSlider 
              progress={task.status === "done" ? 100 : task.progress || 0}
              colorClass={task.color}
              onChange={(p) => {
                // Optimistic visual update handled internally by slider
                if (p === 100 && task.status !== "done") {
                  onToggleStatus(task.id, "done");
                } else if (p < 100 && task.status === "done") {
                  onToggleStatus(task.id, "todo");
                }
              }}
              onDragEnd={(p) => {
                if (onUpdate) {
                  onUpdate(task.id, { progress: p, status: p === 100 ? "done" : "todo" });
                }
              }}
            />
          )}
        </div>

        {/* Deadline Dot & Days Left */}
        {task.due_date && task.status !== "done" && (
          <div className="flex items-center gap-2 pt-0.5" title={`Due: ${task.due_date}`}>
            <span className={cn("text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", colorClass)}>
              {daysLeftText}
            </span>
            {dotClass && <div className={cn("w-2 h-2 rounded-full", dotClass)} />}
          </div>
        )}

        {/* Pin: keeps the task at the top of its list */}
        {onUpdate && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUpdate(task.id, { pinned: !task.pinned }); }}
            title={task.pinned ? "Unpin" : "Pin to top"}
            aria-label={task.pinned ? "Unpin" : "Pin to top"}
            className={cn(
              "pt-0.5 -mr-1 shrink-0 transition-opacity relative z-10",
              task.pinned ? "text-white/80" : "opacity-0 group-hover:opacity-100 text-white/30 hover:text-white"
            )}
          >
            <Pin className={cn("w-3.5 h-3.5", task.pinned && "fill-current")} />
          </button>
        )}
      </div>
    </div>
  );
}
