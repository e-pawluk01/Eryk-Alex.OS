"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task, ContextType } from "@/lib/types";
import { X, Tag, AlignLeft, Calendar, Flag, Clock, Trash2 } from "lucide-react";
import { useGlobalContext } from "./global-context";
import { cn } from "@/lib/utils";
import { DatePicker } from "./ui/date-picker";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { ContextTag } from "./ui/context-tag";

interface TaskDetailsPanelProps {
  task: Task | null;
  isOpen?: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailsPanel({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailsPanelProps) {
  const { userEmail } = useGlobalContext();
  const userContextName = (userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk") as ContextType;
  const allowedContexts: ContextType[] = [userContextName, "Reselling", "Drink idea"];

  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTitleAtEnd, setIsTitleAtEnd] = useState(true);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescDraft(task.description || "");
    }
  }, [task]);

  const handleTitleBlur = () => {
    if (titleDraft !== (task?.title || "")) {
      onUpdate(task!.id, { title: titleDraft });
    }
  };

  const handleDescBlur = () => {
    if (descDraft !== (task?.description || "")) {
      onUpdate(task!.id, { description: descDraft });
    }
  };

  const checkScroll = () => {
    if (titleInputRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = titleInputRef.current;
      setIsTitleAtEnd(Math.abs(scrollWidth - clientWidth - scrollLeft) <= 2);
    }
  };

  useEffect(() => {
    checkScroll();
  }, [titleDraft, isOpen]);

  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[60] transition-opacity" 
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-black/80 backdrop-blur-2xl border-l border-white/10 z-[70] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex flex-col gap-4 p-6 border-b border-white/5 relative">
          
          <div className="flex items-start justify-between gap-4">
            {/* Title with conditional gradient fade */}
            <div className={cn(
              "flex-1 relative transition-all duration-300",
              !isTitleAtEnd && "[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]"
            )}>
              <input 
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onScroll={checkScroll}
                onBlur={handleTitleBlur}
                className="w-full bg-transparent text-xl font-semibold text-white outline-none placeholder:text-muted-foreground"
                placeholder="Task title..."
              />
            </div>
            
            <button onClick={onClose} className="p-1.5 -mr-1.5 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-6 text-xs mt-2">
            <DatePicker 
              value={task.scheduled_date} 
              onChange={(date) => onUpdate(task.id, { scheduled_date: date })} 
              icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
              placeholder="Schedule"
            />
            
            <DatePicker 
              value={task.due_date} 
              onChange={(date) => onUpdate(task.id, { due_date: date })} 
              icon={<Flag className="w-3.5 h-3.5 text-muted-foreground" />}
              placeholder="Deadline"
            />
          </div>
        </div>

        {/* Body (Plain Text Note) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={handleDescBlur}
            placeholder="Write a note..."
            className="w-full flex-1 bg-transparent text-sm text-foreground/90 focus:outline-none resize-none leading-relaxed min-h-[150px]"
          />
        </div>
        
        {/* Footer Actions */}
        <div className="p-6 bg-zinc-950/50 border-t border-white/5 flex flex-col gap-4 shrink-0">
          
          {/* Extra Options */}
          <div className="flex items-center justify-between group py-2">
            <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
              <span className="text-[9px] uppercase tracking-widest font-semibold">
                Track Progress
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdate(task.id, { track_progress: !task.track_progress, progress: !task.track_progress ? 0 : task.progress })}
              className={cn(
                "w-8 h-4 rounded-full transition-colors relative",
                task.track_progress ? "bg-white" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
                task.track_progress ? "left-[18px] bg-black" : "left-0.5 bg-white/50"
              )} />
            </button>
          </div>
          
          {/* Bottom Actions */}
          <div className="flex items-end justify-end">

            <button 
              onClick={() => setIsDeleteDialogOpen(true)} 
              className="p-3 hover:bg-red-500/10 rounded-full transition-colors text-red-500/50 hover:text-red-500 shrink-0"
              title="Delete Task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>

      <ConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => onDelete(task.id)}
        title="Delete Task?"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />
    </>
  );
}
