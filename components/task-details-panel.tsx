"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/lib/types";
import { X, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TaskDetailsPanelProps {
  task: Task | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
}

export function TaskDetailsPanel({ task, onClose, onUpdate }: TaskDetailsPanelProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (task) {
      setDescDraft(task.description || "");
      setTitleDraft(task.title);
      setIsEditingDesc(false);
    }
  }, [task]);

  if (!task) return null;

  const handleSaveDesc = () => {
    onUpdate(task.id, { description: descDraft });
    setIsEditingDesc(false);
  };

  const handleTitleBlur = () => {
    if (titleDraft.trim() !== task.title) {
      onUpdate(task.id, { title: titleDraft.trim() });
    }
  };

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
        <div className="flex items-start justify-between p-6 border-b border-white/5">
          <div className="flex-1 flex flex-col gap-2">
            <input 
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              className="bg-transparent text-xl font-medium tracking-wide text-white focus:outline-none placeholder:text-muted-foreground w-full"
            />
            
            {/* Deadline */}
            {task.due_date ? (
              <div className="flex items-center gap-2 text-xs text-red-400 group relative">
                <Calendar className="w-3 h-3" />
                <span>Due: {task.due_date}</span>
                <button 
                  onClick={() => onUpdate(task.id, { due_date: null })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-muted-foreground hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer w-max">
                <Calendar className="w-3 h-3" />
                <span>Add deadline?</span>
                <input 
                  type="date" 
                  className="opacity-0 absolute w-0 h-0"
                  onChange={(e) => onUpdate(task.id, { due_date: e.target.value })}
                />
              </label>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Obsidian Note) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Note</span>
            <button 
              onClick={() => isEditingDesc ? handleSaveDesc() : setIsEditingDesc(true)}
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              {isEditingDesc ? "Save" : "Edit"}
            </button>
          </div>

          {isEditingDesc ? (
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              className="w-full flex-1 bg-transparent text-sm text-foreground focus:outline-none resize-none leading-relaxed font-mono"
              placeholder="Write a note (Markdown supported)..."
              autoFocus
            />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-foreground/90">
              {task.description ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.description}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic cursor-pointer" onClick={() => setIsEditingDesc(true)}>
                  No note. Click to add one...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
