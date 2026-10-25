"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task, ContextType } from "@/lib/types";
import { X, Flag, Clock, Trash2, Users, Percent, Timer } from "lucide-react";
import { useGlobalContext } from "./global-context";
import { cn } from "@/lib/utils";
import { DatePicker } from "./ui/date-picker";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { TagPicker } from "./tags/tags";
import { ContextTag } from "./ui/context-tag";
import { TaskTimer, TimeLimitFields } from "./task-timer";

interface TaskDetailsPanelProps {
  task: Task | null;
  isOpen?: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const WIDTH_KEY = "task-panel-width";
const MIN_WIDTH = 380;

/** A switch row shown as just an icon; its name fades in on hover. */
function IconSwitch({ icon: Icon, label, on, onToggle }: { icon: React.ElementType; label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between group py-2">
      <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors" title={label}>
        <Icon className="w-4 h-4" />
        <span className="text-[9px] uppercase tracking-widest font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={cn(
          "w-8 h-4 rounded-full transition-colors relative",
          on ? "bg-white" : "bg-white/10"
        )}
      >
        <div className={cn(
          "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300",
          on ? "left-[18px] bg-black" : "left-0.5 bg-white/50"
        )} />
      </button>
    </div>
  );
}

export function TaskDetailsPanel({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailsPanelProps) {
  const { userEmail } = useGlobalContext();
  const userContextName = (userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk") as ContextType;
  const allowedContexts: ContextType[] = [userContextName, "Reselling", "Drink idea"];

  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // Panel width: drag its left edge; remembered for next time.
  const [width, setWidth] = useState(448);
  const [resizing, setResizing] = useState(false);
  // Time Limit can be switched on before any time is typed in.
  const [limitOn, setLimitOn] = useState(false);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescDraft(task.description || "");
    }
  }, [task]);

  useEffect(() => {
    setLimitOn(!!task?.time_limit_minutes);
  }, [task?.id, task?.time_limit_minutes]);

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

  // Long titles wrap onto more lines; the box grows to fit.
  const growTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(growTitle, [titleDraft, isOpen, width]);

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? "");
      if (saved) setWidth(saved);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const move = (e: PointerEvent) => {
      const max = Math.min(960, window.innerWidth - 40);
      setWidth(Math.round(Math.max(MIN_WIDTH, Math.min(max, window.innerWidth - e.clientX))));
    };
    const up = () => setResizing(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resizing]);

  useEffect(() => {
    if (resizing) return;
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* optional */ }
  }, [resizing, width]);

  if (!task) return null;
  const isStudy = task.domain === "STUDY";
  const timed = isStudy && limitOn;

  const toggleLimit = () => {
    if (limitOn) { setLimitOn(false); onUpdate(task.id, { time_limit_minutes: null }); }
    else { setLimitOn(true); if (task.track_progress) onUpdate(task.id, { track_progress: false }); }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[60] transition-opacity" 
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 max-w-full bg-black/80 backdrop-blur-2xl border-l border-white/10 z-[70] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        style={{ width }}
      >
        {/* Drag handle on the left edge */}
        <div
          onPointerDown={e => { e.preventDefault(); setResizing(true); }}
          title="Drag to resize"
          className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize group z-10"
        >
          <div className={cn(
            "absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all",
            resizing ? "h-16 bg-white/40" : "h-10 bg-white/10 group-hover:h-16 group-hover:bg-white/40"
          )} />
        </div>
        
        {/* Header */}
        <div className="flex flex-col gap-4 p-6 border-b border-white/5 relative">
          
          <div className="flex items-start justify-between gap-4">
            <textarea
              ref={titleRef}
              rows={1}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              onBlur={handleTitleBlur}
              className="flex-1 min-w-0 bg-transparent text-xl font-semibold text-white outline-none resize-none overflow-hidden leading-snug placeholder:text-muted-foreground"
              placeholder="Task title..."
            />
            
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
          <div className="mb-6">
            <TagPicker value={task.tag_id ?? null} onChange={id => onUpdate(task.id, { tag_id: id })} />
          </div>
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
          
          {/* Time Limit (Study only): work on it for this long, then it ticks itself off */}
          {isStudy && <IconSwitch icon={Timer} label="Time limit" on={limitOn} onToggle={toggleLimit} />}
          {timed && (
            <TimeLimitFields
              key={task.id}
              minutes={task.time_limit_minutes ?? null}
              onChange={m => onUpdate(task.id, { time_limit_minutes: m })}
            />
          )}

          {/* Extra Options (hidden for timed tasks: the time bar shows progress) */}
          {!timed && (
            <IconSwitch
              icon={Percent}
              label="Track progress"
              on={!!task.track_progress}
              onToggle={() => onUpdate(task.id, { track_progress: !task.track_progress, progress: !task.track_progress ? 0 : task.progress })}
            />
          )}

          {/* Joint Task Toggle (WORK only) */}
          {task.domain === "WORK" && (
            <IconSwitch icon={Users} label="Joint task" on={!!task.is_joint} onToggle={() => onUpdate(task.id, { is_joint: !task.is_joint })} />
          )}
          
          {/* Bottom Actions: play, time bar and delete for a timed task; just delete otherwise */}
          <div className={cn("flex items-center gap-2.5", timed && task.time_limit_minutes ? "justify-between" : "justify-end")}>
            {timed && !!task.time_limit_minutes && <TaskTimer task={task} person={userContextName} />}

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
