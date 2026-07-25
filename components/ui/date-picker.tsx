"use client";

import React, { useState, useRef, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

export function DatePicker({ value, onChange, placeholder = "Select date", icon }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const parsedValue = value ? parseISO(value) : null;
  const [currentMonth, setCurrentMonth] = useState(parsedValue ? startOfMonth(parsedValue) : startOfMonth(new Date()));
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer group w-max"
      >
        {icon}
        <span className={cn("text-xs font-medium", value ? "text-white" : "text-muted-foreground")}>
          {value ? format(parseISO(value), "MMM d, yyyy") : placeholder}
        </span>
        {value && (
          <button 
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition-all text-muted-foreground hover:text-white ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 p-4 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[150] w-[260px] animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold tracking-wide">{format(currentMonth, "MMMM yyyy")}</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-[10px] tracking-widest text-muted-foreground/50 uppercase">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {paddingDays.map(i => <div key={`pad-${i}`} />)}
            {daysInMonth.map(day => {
              const isSelected = parsedValue ? isSameDay(day, parsedValue) : false;
              const isTodayDate = isToday(day);
              
              return (
                <button
                  key={day.toString()}
                  onClick={() => {
                    onChange(format(day, "yyyy-MM-dd"));
                    setIsOpen(false);
                  }}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-md text-[11px] transition-all",
                    isSelected 
                      ? "bg-white text-black font-semibold" 
                      : "text-white/80 hover:bg-white/10",
                    isTodayDate && !isSelected ? "text-blue-400 font-bold" : ""
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex justify-center">
            <button 
              onClick={() => {
                onChange(format(new Date(), "yyyy-MM-dd"));
                setIsOpen(false);
              }}
              className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-white transition-colors"
            >
              Today
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
