"use client";

import React, { useState } from "react";
import { Task } from "@/lib/types";
import { CustomCheckbox } from "./ui/custom-checkbox";
import { ContextTag } from "./ui/context-tag";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggleStatus: (id: string, newStatus: "todo" | "done") => void;
  level?: number;
}

export function TaskItem({ task, onToggleStatus, level = 0 }: TaskItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = task.subTasks && task.subTasks.length > 0;

  return (
    <div className="flex flex-col w-full">
      <div 
        className={cn(
          "flex items-start gap-3 py-3 group hover:bg-white/[0.02] transition-colors rounded-md pr-3",
          level > 0 ? "ml-6" : ""
        )}
      >
        <div className="flex items-center pt-0.5 min-w-5 justify-center">
          {hasSubtasks ? (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4 h-4" /> // placeholder for alignment
          )}
        </div>
        
        <div className="pt-0.5">
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
            <ContextTag context={task.context} />
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </div>
      
      {hasSubtasks && expanded && (
        <div className="flex flex-col relative before:absolute before:left-[17px] before:top-0 before:bottom-4 before:w-[1px] before:bg-border/50">
          {task.subTasks!.map(subtask => (
            <TaskItem 
              key={subtask.id} 
              task={subtask} 
              onToggleStatus={onToggleStatus} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
