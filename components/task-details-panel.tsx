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
  const [projectDraft, setProjectDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTitleAtEnd, setIsTitleAtEnd] = useState(true);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescDraft(task.description || "");
      setProjectDraft(task.project || "");
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

  const handleProjectBlur = () => {
    if (projectDraft !== (task?.project || "")) {
      onUpdate(task!.id, { project: projectDraft.trim() || null });
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
        <div className="flex-1 p-6 flex flex-col relative">
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={handleDescBlur}
            placeholder="Write a note..."
            className="w-full flex-1 bg-transparent text-sm text-foreground/90 focus:outline-none resize-none leading-relaxed pb-20"
          />
          
          {/* Extra Options */}
          <div className="absolute bottom-28 left-6 right-6 flex flex-col gap-2">
            <div className="flex items-center justify-between group py-2">
              <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                <div className="w-3 h-3 rounded-sm border border-current flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-current" />
                </div>
                <span className="text-[9px] uppercase tracking-widest font-semibold">
                  Track Progress (%)
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
          </div>
          
          {/* Bottom Actions */}
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between pointer-events-none">
            
            {/* Project & Color (Left) */}
            <div className="flex flex-col gap-3 pointer-events-auto w-[60%]">
              <input 
                type="text"
                value={projectDraft}
                onChange={(e) => setProjectDraft(e.target.value)}
                onBlur={handleProjectBlur}
                placeholder="Project Tag..."
                className="bg-transparent border-b border-white/10 pb-1 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all w-full"
              />
              
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onUpdate(task.id, { color: null })}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center bg-transparent",
                    task.color === null ? "border-white scale-110" : "border-white/10 opacity-50 hover:opacity-100"
                  )}
                >
                  <X className="w-2.5 h-2.5 text-white/50" />
                </button>
                {[
                  { name: "Purple", class: "bg-purple-500" },
                  { name: "Blue", class: "bg-blue-500" },
                  { name: "Emerald", class: "bg-emerald-500" },
                  { name: "Amber", class: "bg-amber-500" },
                  { name: "Rose", class: "bg-rose-500" },
                  { name: "Cyan", class: "bg-cyan-500" },
                  { name: "Zinc", class: "bg-zinc-500" },
                ].map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onUpdate(task.id, { color: c.class })}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-all cursor-pointer",
                      c.class,
                      task.color === c.class ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  />
                ))}
              </div>
            </div>
            
            {/* Delete Button (Right) */}
            <button 
              onClick={() => setIsDeleteDialogOpen(true)} 
              className="p-3 hover:bg-red-500/10 rounded-full transition-colors text-red-500/50 hover:text-red-500 shrink-0 pointer-events-auto"
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
