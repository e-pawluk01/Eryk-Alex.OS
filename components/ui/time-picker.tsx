"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string | null;
  onChange: (time: string | null) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

const HOURS = Array.from({length: 24}).map((_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({length: 12}).map((_, i) => (i * 5).toString().padStart(2, '0'));

export function TimePicker({ value, onChange, placeholder = "Select time", icon }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // value is expected to be "HH:mm"
  const selectedHour = value ? value.split(':')[0] : "12";
  const selectedMinute = value ? value.split(':')[1] : "00";

  const [hour, setHour] = useState(selectedHour);
  const [minute, setMinute] = useState(selectedMinute);

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

  const handleApply = () => {
    onChange(`${hour}:${minute}`);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer group w-max"
      >
        {icon}
        <span className={cn("text-xs font-medium", value ? "text-white" : "text-muted-foreground")}>
          {value ? value : placeholder}
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
        <div className="absolute top-full left-0 mt-1 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[150] w-[240px] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          
          <div className="flex h-[200px]">
            {/* Hours Column */}
            <div className="flex-1 flex flex-col border-r border-white/5">
              <div className="py-2 text-center border-b border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Hour</span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {HOURS.map(h => (
                  <button
                    key={h}
                    onClick={() => setHour(h)}
                    className={cn(
                      "py-1.5 rounded-md text-xs font-mono transition-colors",
                      hour === h 
                        ? "bg-white text-black font-bold" 
                        : "text-white/60 hover:bg-white/10"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="flex-1 flex flex-col">
              <div className="py-2 text-center border-b border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Min</span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    onClick={() => setMinute(m)}
                    className={cn(
                      "py-1.5 rounded-md text-xs font-mono transition-colors",
                      minute === m 
                        ? "bg-white text-black font-bold" 
                        : "text-white/60 hover:bg-white/10"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
            <span className="text-sm font-mono font-bold tracking-widest">{hour}:{minute}</span>
            <button 
              onClick={handleApply}
              className="flex items-center gap-1.5 bg-white text-black px-3 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold hover:bg-white/90 transition-colors"
            >
              <Check className="w-3 h-3" /> Done
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
