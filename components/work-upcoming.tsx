"use client";

import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { differenceInMinutes, format, parseISO } from "date-fns";
import { Event, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TagChip } from "@/components/tags/tags";

const TAB_KEY = "work-upcoming-tab";

const plainLabel = (text: string) => (
  <span className="px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-widest font-bold border border-border text-muted-foreground">{text}</span>
);

/**
 * One card frame for tasks and events, so switching pills doesn't move anything:
 * same width and rows, a one-line title that ends in … when too long, date line at the bottom.
 */
function UpcomingCard({ onClick, label, when, whenClass, title, left, right, borderClass }: {
  onClick: () => void;
  label: React.ReactNode;
  when: string;
  whenClass: string;
  title: string;
  left: string;
  right?: React.ReactNode;
  borderClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-[240px] shrink-0 overflow-hidden bg-card border p-4 rounded-lg flex flex-col gap-3 text-left hover:bg-white/[0.03] transition-colors", borderClass)}
    >
      <div className="flex items-center justify-between gap-2 w-full h-5">
        {label}
        <span className={cn("font-mono tabular-nums text-xs font-semibold", whenClass)}>{when}</span>
      </div>
      <span className="block w-full min-w-0 font-medium text-foreground leading-snug truncate" title={title}>{title}</span>
      <span className="mt-auto text-[11px] text-muted-foreground flex justify-between items-center gap-2 w-full h-4">
        <span>{left}</span>
        <span className="flex items-center gap-1">{right}</span>
      </span>
    </button>
  );
}

/** Work home's top strip: your own and joint tasks on later days, or upcoming Work events. */
export function WorkUpcoming({ tasks, events, me, onSelectTask, onSelectEvent }: {
  tasks: Task[];
  events: Event[];
  me: string;
  onSelectTask: (t: Task) => void;
  onSelectEvent: (e: Event) => void;
}) {
  const [tab, setTab] = useState<"tasks" | "events">("tasks");
  useEffect(() => {
    try { if (localStorage.getItem(TAB_KEY) === "events") setTab("events"); } catch { /* optional */ }
  }, []);
  const pickTab = (t: "tasks" | "events") => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* optional */ }
  };

  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const today = format(now, "yyyy-MM-dd");
  const daysAway = (date: string) => Math.round((parseISO(date).getTime() - parseISO(today).getTime()) / 86_400_000);

  const upcomingTasks = tasks
    .filter(t => (t.domain ?? "WORK") === "WORK" && !t.parent_id && t.status !== "done"
      && !!t.scheduled_date && t.scheduled_date > today && (t.context === me || t.is_joint))
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!))
    .slice(0, 8);

  const startOf = (e: Event) => parseISO(`${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : "23:59"}:00`);
  const upcomingEvents = events
    .filter(e => (e.domain ?? "WORK") === "WORK" && e.event_date >= today && startOf(e) > now)
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime())
    .slice(0, 8);

  const eventWhen = (e: Event) => {
    if (e.event_date === today && e.event_time) {
      const mins = differenceInMinutes(startOf(e), now);
      return mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    }
    if (e.event_date === today) return "today";
    const days = daysAway(e.event_date);
    return days === 1 ? "tomorrow" : `in ${days}d`;
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Upcoming</h2>
        <div className="flex gap-1.5">
          {(["tasks", "events"] as const).map(t => (
            <button
              key={t}
              onClick={() => pickTab(t)}
              className={cn(
                "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all",
                tab === t ? "bg-white/15 text-white border-white/30" : "bg-white/[0.03] text-white/40 border-white/10 hover:text-white"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 px-2 min-h-[131px] hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tab === "tasks" ? (
          upcomingTasks.length ? upcomingTasks.map(t => {
            const days = daysAway(t.scheduled_date!);
            return (
              <UpcomingCard
                key={t.id}
                onClick={() => onSelectTask(t)}
                label={t.tag_id ? <TagChip tagId={t.tag_id} /> : plainLabel("Task")}
                when={days === 1 ? "tomorrow" : `in ${days}d`}
                whenClass="text-muted-foreground"
                title={t.title}
                left={format(parseISO(t.scheduled_date!), "EEE d MMM")}
                right={t.is_joint ? <Users className="w-3 h-3 text-blue-400" /> : null}
                borderClass="border-border"
              />
            );
          }) : <p className="text-xs text-white/30 italic py-6 px-2">No upcoming Work tasks.</p>
        ) : (
          upcomingEvents.length ? upcomingEvents.map(e => {
            const isToday = e.event_date === today;
            return (
              <UpcomingCard
                key={e.id}
                onClick={() => onSelectEvent(e)}
                label={e.tag_id ? <TagChip tagId={e.tag_id} /> : plainLabel("Event")}
                when={eventWhen(e)}
                whenClass={isToday ? "text-white" : "text-muted-foreground"}
                title={e.title}
                left={`${isToday ? "Today" : format(parseISO(e.event_date), "EEE d MMM")}${e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ""}`}
                borderClass={isToday ? "border-white/30" : "border-border"}
              />
            );
          }) : <p className="text-xs text-white/30 italic py-6 px-2">No upcoming Work events.</p>
        )}
      </div>
    </section>
  );
}
