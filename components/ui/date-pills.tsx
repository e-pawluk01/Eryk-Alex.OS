"use client";

import React, { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, format, getDay,
  isAfter, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";

interface DatePillsProps {
  value: Date;
  onChange: (date: Date) => void;
  // Days before this can't be picked (e.g. months whose report is locked).
  earliest?: Date;
}

// Last 7 days as one-tap pills; the calendar icon opens a small in-app
// month grid for anything older. Future days, and days before `earliest`,
// can't be picked.
export function DatePills({ value, onChange, earliest }: DatePillsProps) {
  const today = startOfDay(new Date());
  const outOfRange = (d: Date) => isAfter(d, today) || (!!earliest && isBefore(d, startOfDay(earliest)));
  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const inStrip = strip.some((d) => isSameDay(d, value));

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(value));

  const pick = (d: Date) => {
    onChange(d);
    setCalendarOpen(false);
  };

  const pillClass = (selected: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 min-h-12 min-w-0 py-1.5 rounded-lg border transition-colors",
      selected
        ? "bg-white border-white text-black"
        : "bg-black/40 border-white/10 text-white/85 hover:border-white/25"
    );

  const monthDays = eachDayOfInterval({ start: month, end: endOfMonth(month) });
  const leadingBlanks = (getDay(month) + 6) % 7; // weeks start on Monday
  const canGoForward = !isAfter(addMonths(month, 1), today);
  const canGoBack = !earliest || isAfter(month, startOfMonth(earliest));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-8 gap-1" role="group" aria-label="Date">
        {strip.map((d) => {
          const selected = isSameDay(d, value);
          const blocked = outOfRange(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={blocked}
              onClick={() => pick(d)}
              aria-pressed={selected}
              aria-label={format(d, "EEEE d MMMM")}
              className={cn(pillClass(selected), blocked && "opacity-25 cursor-default hover:border-white/10")}
            >
              <span className={cn("text-[8px] font-bold uppercase tracking-wider whitespace-nowrap", selected ? "text-black/55" : "text-muted-foreground/50")}>
                {isSameDay(d, today) ? "Today" : format(d, "EEE")}
              </span>
              <span className="text-sm font-semibold tabular-nums">{format(d, "d")}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            if (!calendarOpen) setMonth(startOfMonth(value));
            setCalendarOpen(!calendarOpen);
          }}
          aria-expanded={calendarOpen}
          aria-label="Pick an earlier date"
          className={pillClass(!inStrip)}
        >
          {inStrip ? (
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
          ) : (
            <>
              <span className="text-[8px] font-bold uppercase tracking-wider text-black/55">{format(value, "MMM")}</span>
              <span className="text-sm font-semibold tabular-nums">{format(value, "d")}</span>
            </>
          )}
        </button>
      </div>

      {calendarOpen && (
        <div className="bg-black/40 border border-white/10 rounded-xl px-2.5 pt-2 pb-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => canGoBack && setMonth(addMonths(month, -1))}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-white">{format(month, "MMMM yyyy")}</span>
            <button
              type="button"
              onClick={() => canGoForward && setMonth(addMonths(month, 1))}
              disabled={!canGoForward}
              aria-label="Next month"
              className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
              <span key={i} className="text-[9px] font-bold text-muted-foreground/50 py-1">{w}</span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => <span key={`b${i}`} />)}
            {monthDays.map((d) => {
              const blocked = outOfRange(d);
              const selected = isSameDay(d, value) && isSameMonth(d, month);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={blocked}
                  onClick={() => pick(d)}
                  className={cn(
                    "py-1.5 rounded-md text-xs tabular-nums transition-colors",
                    selected ? "bg-white text-black font-bold" : "text-white/80 hover:bg-white/10",
                    blocked && "text-white/15 hover:bg-transparent cursor-default"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
