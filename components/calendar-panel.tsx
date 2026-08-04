"use client";

import React, { useState, useEffect } from "react";
import { Task, Event } from "@/lib/types";
import { DomainType } from "./global-context";
import { X, ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { 
  startOfMonth, endOfMonth, eachDayOfInterval, format, 
  isSameDay, isToday, addMonths, subMonths, parseISO, startOfDay
} from "date-fns";
import { cn } from "@/lib/utils";
import { ContextType } from "@/lib/types";
import { NewCalendarItemDialog } from "./new-calendar-item-dialog";

const contextDotColors: Record<ContextType, string> = {
  Eryk: "bg-blue-400",
  Alex: "bg-purple-400",
  Reselling: "bg-amber-400",
  "Drink idea": "bg-emerald-400",
};

const domainPillColors: Record<DomainType, string> = {
  WORK: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  STUDY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  CONTENT: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const domainDotColors: Record<DomainType, string> = {
  WORK: "bg-blue-400",
  STUDY: "bg-purple-400",
  CONTENT: "bg-emerald-400",
};

interface CalendarPanelProps {
  tasks: Task[];
  events: Event[];
  currentDomain: DomainType;
  userEmail: string | null;
  onAddTask: (task: Task) => void;
  onAddEvent: (event: Event) => void;
  onSelectTask: (task: Task) => void;
  onSelectEvent: (event: Event) => void;
}

export function CalendarPanel({ tasks, events, currentDomain, userEmail, onAddTask, onAddEvent, onSelectTask, onSelectEvent }: CalendarPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterDomain, setFilterDomain] = useState<DomainType | "ALL">("ALL");

  const userContextName = (userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk") as ContextType;

  const selectedDayTasks = tasks.filter(t => 
    t.scheduled_date && 
    isSameDay(parseISO(t.scheduled_date), selectedDate) &&
    (filterDomain === "ALL" || (t.domain || "WORK") === filterDomain)
  );

  const selectedDayEvents = events.filter(e => 
    isSameDay(parseISO(e.event_date), selectedDate) &&
    (filterDomain === "ALL" || (e.domain || "WORK") === filterDomain)
  );

  // Calendar Grid Logic
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  // Calculate padding for the first day of the month (0 = Sunday)
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);

  return (
    <>
      {/* The Icon Trigger */}
      <button 
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-white/10 border border-white/10 border-r-0 backdrop-blur-md",
          "rounded-l-lg py-4 px-3 cursor-pointer z-40 transition-all duration-300",
          isOpen ? "translate-x-full" : "translate-x-0"
        )}
      >
        <Calendar className="w-5 h-5 text-white/80" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-over Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-[380px] bg-[#09090b] z-50",
          "transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        
        {/* Calendar Widget matching mockup exactly */}
        <div className="p-6 relative">
          
          <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-between mb-8 mt-2 pr-12">
            <h3 className="text-sm font-semibold tracking-wide">{format(currentMonth, "MMMM yyyy")}</h3>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-muted-foreground hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-muted-foreground hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center mb-4">
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
              <div key={d} className="text-[10px] tracking-widest text-muted-foreground/60">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-y-4 gap-x-2">
            {paddingDays.map(i => <div key={`pad-${i}`} />)}
            {daysInMonth.map(day => {
              const isSelected = isSameDay(day, selectedDate);
              const hasItems = tasks.some(t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day) && (filterDomain === "ALL" || (t.domain || "WORK") === filterDomain)) || 
                               events.some(e => isSameDay(parseISO(e.event_date), day) && (filterDomain === "ALL" || (e.domain || "WORK") === filterDomain));
              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative h-9 flex flex-col items-center justify-center rounded-xl text-xs transition-all",
                    isSelected ? "bg-white text-black font-semibold" : "text-white hover:bg-white/10"
                  )}
                >
                  <span className={hasItems ? "-mt-1" : ""}>{format(day, "d")}</span>
                  {hasItems && (
                    <div className={cn("absolute bottom-1.5 w-1 h-1 rounded-full", isSelected ? "bg-black/50" : "bg-white/30")} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 flex flex-col gap-6 mt-2">
          
          {/* Domain Filter */}
          <div className="flex gap-2 mb-2 bg-[#111] p-1 rounded-xl border border-white/5">
            {(["ALL", "WORK", "STUDY", "CONTENT"] as const).map(domain => (
              <button
                key={domain}
                onClick={() => setFilterDomain(domain)}
                className={cn(
                  "flex-1 text-[9px] font-bold uppercase tracking-wider py-1.5 rounded-lg transition-colors",
                  filterDomain === domain 
                    ? "bg-white/10 text-white" 
                    : "text-muted-foreground/60 hover:text-white hover:bg-white/5"
                )}
              >
                {domain}
              </button>
            ))}
          </div>

          {/* Events Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Events
            </h3>
            {selectedDayEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 italic py-2">No events scheduled.</div>
            ) : (
              selectedDayEvents.map(event => {
                const dom = event.domain || "WORK";
                return (
                  <div 
                    key={event.id} 
                    onClick={() => onSelectEvent(event)}
                    className="flex flex-col bg-[#111] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors relative overflow-hidden"
                  >
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", domainDotColors[dom])} />
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium">{event.title}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", domainPillColors[dom])}>
                        {dom}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {event.event_time ? event.event_time.slice(0, 5) : "All day"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Tasks Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Tasks
            </h3>
            {selectedDayTasks.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 italic py-2">No tasks scheduled.</div>
            ) : (
              selectedDayTasks.map(task => {
                const dom = task.domain || "WORK";
                return (
                  <div 
                    key={task.id} 
                    onClick={() => onSelectTask(task)}
                    className="flex flex-col gap-2 bg-[#111] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.2)]", domainDotColors[dom])} />
                        <span className={cn("text-sm break-words line-clamp-2", task.status === "done" && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                      </div>
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ml-2", domainPillColors[dom])}>
                        {dom}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Floating Action Button */}
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-6 right-6 w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all z-[60]"
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
        </button>

      </div>

      <NewCalendarItemDialog 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        contextName={userContextName}
        domainName={currentDomain}
        selectedDateString={format(selectedDate, "yyyy-MM-dd")}
        onTaskAdded={onAddTask}
        onEventAdded={onAddEvent}
      />
    </>
  );
}
