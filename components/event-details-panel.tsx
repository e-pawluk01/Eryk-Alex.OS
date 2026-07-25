"use client";

import React, { useState, useEffect } from "react";
import { Event, ContextType } from "@/lib/types";
import { X, Tag, AlignLeft, Calendar, Clock, Trash2 } from "lucide-react";
import { useGlobalContext } from "./global-context";
import { cn } from "@/lib/utils";
import { DatePicker } from "./ui/date-picker";
import { TimePicker } from "./ui/time-picker";
import { ConfirmDialog } from "./ui/confirm-dialog";

interface EventDetailsPanelProps {
  event: Event | null;
  isOpen?: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Event>) => void;
  onDelete: (id: string) => void;
}

export function EventDetailsPanel({ event, isOpen, onClose, onUpdate, onDelete }: EventDetailsPanelProps) {
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setTitleDraft(event.title);
      setDescDraft(event.description || "");
    }
  }, [event]);

  if (!event) return null;

  const handleTitleBlur = () => {
    if (titleDraft.trim() !== event.title) {
      onUpdate(event.id, { title: titleDraft.trim() });
    }
  };

  const handleDescBlur = () => {
    if (descDraft !== (event.description || "")) {
      onUpdate(event.id, { description: descDraft });
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
            
            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              {/* Event Date */}
              <DatePicker 
                value={event.event_date} 
                onChange={(date) => onUpdate(event.id, { event_date: date || event.event_date })} 
                icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
                placeholder="Event Date..."
              />

              {/* Event Time */}
              <TimePicker 
                value={event.event_time} 
                onChange={(time) => onUpdate(event.id, { event_time: time })} 
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                placeholder="Event Time..."
              />
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Plain Text Note) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col relative">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Note</span>
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => {
              if (descDraft !== (event.description || "")) {
                onUpdate(event.id, { description: descDraft });
              }
            }}
            placeholder="Add a note..."
            className="w-full flex-1 bg-transparent text-sm text-foreground/90 focus:outline-none resize-none leading-relaxed pb-12"
          />
          
          <button 
            onClick={() => setIsDeleteDialogOpen(true)} 
            className="absolute bottom-6 right-6 p-3 hover:bg-red-500/20 rounded-full transition-colors text-red-500/50 hover:text-red-500 shrink-0"
            title="Delete Event"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          onDelete(event.id);
          onClose();
        }}
        title="Delete Event?"
        description="Are you sure you want to delete this event? This action cannot be undone."
      />
    </>
  );
}
