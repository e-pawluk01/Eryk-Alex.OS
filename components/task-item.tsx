"use client";

import React, { useState } from "react";
import { Task } from "@/lib/types";
import { CustomCheckbox } from "./ui/custom-checkbox";
import { cn } from "@/lib/utils";
import { differenceInDays, startOfDay } from "date-fns";
import { Repeat } from "lucide-react";

interface TaskItemProps {
  task: Task;
  onToggleStatus: (id: string, newStatus: "todo" | "done") => void;
  onSelect?: (task: Task) => void;
}

export function TaskItem({ task, onToggleStatus, onSelect }: TaskItemProps) {

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
        className="flex items-start gap-4 p-4 group hover:bg-white/[0.02] transition-colors rounded-lg cursor-pointer relative"
        onClick={(e) => {
          // Prevent opening panel if clicking checkbox
          if (onSelect) onSelect(task);
        }}
      >
        <div className="pt-0.5" onClick={e => e.stopPropagation()}>
          <CustomCheckbox 
            checked={task.status === "done"} 
            onChange={(checked) => onToggleStatus(task.id, checked ? "done" : "todo")} 
          />
        </div>
        
        <div className="flex flex-col flex-1 gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm font-medium transition-colors line-clamp-1",
              task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {task.title}
            </span>
            {task.is_daily && (
              <Repeat className="w-3 h-3 text-muted-foreground ml-1" />
            )}
            {task.project && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.2)]",
                task.project === "Reselling" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
              )}>
                {task.project}
              </span>
            )}
            {task.domain === "CONTENT" && task.context && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.2)]",
                task.context === "Eryk" 
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
              )}>
                {task.context.charAt(0)}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
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
      </div>
    </div>
  );
}
