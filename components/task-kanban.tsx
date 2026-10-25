"use client";

import React, { useState } from "react";
import { CircleCheck, CircleDashed, Contrast } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskItem } from "./task-item";

type Stage = "todo" | "doing" | "done";

const COLUMNS: { stage: Stage; label: string; icon: React.ElementType }[] = [
  { stage: "todo", label: "Not started", icon: CircleDashed },
  { stage: "doing", label: "In progress", icon: Contrast },
  { stage: "done", label: "Done", icon: CircleCheck },
];

export const stageOf = (t: Task): Stage => (t.status === "done" ? "done" : t.in_progress ? "doing" : "todo");

/** Your own board for the day: drag a task into another column to change its stage. Done = ticked. */
export function TaskKanban({ tasks, onSelect, onUpdate, onToggleStatus }: {
  tasks: Task[];
  onSelect: (t: Task) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onToggleStatus: (id: string, status: "todo" | "done") => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const drop = (stage: Stage) => {
    const task = tasks.find(t => t.id === dragId);
    setDragId(null);
    setOver(null);
    if (!task || stageOf(task) === stage) return;
    const updates: Partial<Task> = { status: stage === "done" ? "done" : "todo", in_progress: stage === "doing" };
    // Leaving Done puts a full progress bar back to empty, like unticking.
    if (task.track_progress && stage !== "done" && (task.progress ?? 0) >= 100) updates.progress = 0;
    onUpdate(task.id, updates);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(({ stage, label, icon: Icon }) => (
        <div
          key={stage}
          onDragOver={e => { if (dragId) { e.preventDefault(); setOver(stage); } }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
          onDrop={e => { e.preventDefault(); drop(stage); }}
          className={cn(
            "flex flex-col gap-2 min-h-[420px] rounded-lg border bg-card p-2 transition-colors",
            over === stage ? "border-white/30 bg-white/[0.04]" : "border-border"
          )}
        >
          <div className="flex items-center justify-center py-2 text-white/50" title={label} aria-label={label}>
            <Icon className="w-4 h-4" />
          </div>
          {tasks.filter(t => stageOf(t) === stage).map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={e => { setDragId(task.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); }}
              onDragEnd={() => { setDragId(null); setOver(null); }}
              className={cn(
                "rounded-lg border border-white/[0.06] bg-white/[0.015] cursor-grab active:cursor-grabbing",
                dragId === task.id && "opacity-40"
              )}
            >
              <TaskItem task={task} noTick onToggleStatus={onToggleStatus} onSelect={() => onSelect(task)} onUpdate={onUpdate} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
