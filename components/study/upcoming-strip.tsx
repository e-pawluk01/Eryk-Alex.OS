"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { differenceInMinutes, format, parseISO } from "date-fns";
import { Event } from "@/lib/types";
import { cn } from "@/lib/utils";
import { byCutoff, daysUntil, isCurrent, progressLabel, shortDate, shortTime, urgency, URGENCY_BORDER } from "@/lib/study";
import { StudyDeadline } from "@/lib/types";
import { StudyData } from "./use-study";
import { Countdown, ModuleDot, OpenTag, TypeChip, WindowBar } from "./bits";
import { DeadlinePanel } from "./deadline-panel";
import { DeadlineDialog } from "./deadline-dialog";
import { ModulesDialog } from "./modules-dialog";
import { DeadlineProgressDialog, ProgressBar } from "./deadline-progress";
import { TagChip } from "@/components/tags/tags";

const TAB_KEY = "study-upcoming-tab";

/** Study home's top strip (where Goals sit in Work): next deadlines, or next timed events (lectures). */
export function UpcomingStrip({ study, events, onSelectEvent }: { study: StudyData; events: Event[]; onSelectEvent: (e: Event) => void }) {
  const [tab, setTab] = useState<"deadlines" | "events">("deadlines");
  useEffect(() => {
    try { if (localStorage.getItem(TAB_KEY) === "events") setTab("events"); } catch { /* optional */ }
  }, []);
  const pickTab = (t: "deadlines" | "events") => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* optional */ }
  };
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const live = study.deadlines.filter(d => !d.done).sort(byCutoff);
  const current = live.filter(isCurrent);
  const comingUp = live.filter(d => !isCurrent(d)).slice(0, 8);
  const open = study.deadlines.find(d => d.id === openId) ?? null;
  const progressFor = study.deadlines.find(d => d.id === progressId) ?? null;

  const card = (d: StudyDeadline, cur: boolean) => {
    const module = study.modules.find(m => m.id === d.module_id);
    return (
      <button
        key={d.id}
        type="button"
        onClick={() => (cur ? setProgressId(d.id) : setOpenId(d.id))}
        className={cn(
          "w-[240px] shrink-0 overflow-hidden bg-card border p-4 rounded-lg flex flex-col gap-3 text-left hover:bg-white/[0.03] transition-colors",
          URGENCY_BORDER[urgency(daysUntil(d.cutoff_on))]
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><TypeChip type={d.type} module={module} /><OpenTag deadline={d} /></span>
          <Countdown deadline={d} className="text-xs font-semibold" />
        </div>
        <div className="flex items-start gap-2 font-medium text-foreground w-full min-w-0">
          <ModuleDot module={module} className="mt-[7px]" />
          <span className="min-w-0 leading-snug line-clamp-2 break-words" title={d.title}>{d.title}</span>
        </div>
        <span className="text-[11px] text-muted-foreground flex justify-between gap-2 w-full">
          <span>{d.opens_on ? "Cut-off " : ""}{shortDate(d.cutoff_on)}{shortTime(d.cutoff_time) ? ` · ${shortTime(d.cutoff_time)}` : ""}</span>
          {cur && <span className="text-white/70 whitespace-nowrap">{progressLabel(d)}</span>}
        </span>
        {cur ? <ProgressBar deadline={d} module={module} /> : <WindowBar deadline={d} module={module} />}
      </button>
    );
  };
  const groupLabel = (text: string) => (
    <div className="shrink-0 flex items-center">
      <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground [writing-mode:vertical-rl] rotate-180">{text}</span>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Upcoming</h2>
        <div className="flex gap-1.5">
          {(["deadlines", "events"] as const).map(t => (
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

      {tab === "events" ? <EventCards events={events} onSelect={onSelectEvent} /> : (
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {current.length > 0 && <>{groupLabel("Working on")}{current.map(d => card(d, true))}</>}
        {current.length > 0 && comingUp.length > 0 && <div className="shrink-0 w-px bg-border mx-1" />}
        {comingUp.length > 0 && <>{groupLabel("Coming up")}{comingUp.map(d => card(d, false))}</>}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-[240px] shrink-0 flex items-center justify-center gap-2 py-4 border border-dashed border-border rounded-lg text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors group"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs uppercase tracking-widest font-semibold">New Deadline</span>
        </button>
      </div>
      )}

      <DeadlinePanel study={study} deadline={open} onClose={() => setOpenId(null)} />
      {progressFor && (
        <DeadlineProgressDialog
          deadline={progressFor}
          module={study.modules.find(m => m.id === progressFor.module_id)}
          onSave={p => study.updateDeadline(progressFor.id, p)}
          onClose={() => setProgressId(null)}
          onDetails={() => { setProgressId(null); setOpenId(progressFor.id); }}
        />
      )}
      {adding && <DeadlineDialog study={study} onClose={() => setAdding(false)} onNeedModule={() => { setAdding(false); setAddingModule(true); }} />}
      {addingModule && <ModulesDialog study={study} startAdding onClose={() => setAddingModule(false)} />}
    </section>
  );
}

/** Upcoming timed and untimed Study events (lectures etc.), soonest first. */
function EventCards({ events, onSelect }: { events: Event[]; onSelect: (e: Event) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const today = format(now, "yyyy-MM-dd");
  const startOf = (e: Event) => parseISO(`${e.event_date}T${e.event_time ? e.event_time.slice(0, 5) : "23:59"}:00`);
  const list = events
    .filter(e => (e.domain ?? "WORK") === "STUDY" && e.event_date >= today && startOf(e) > now)
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime())
    .slice(0, 8);

  const when = (e: Event) => {
    if (e.event_date === today && e.event_time) {
      const mins = differenceInMinutes(startOf(e), now);
      return mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    }
    if (e.event_date === today) return "today";
    const days = Math.round((parseISO(e.event_date).getTime() - parseISO(today).getTime()) / 86_400_000);
    return days === 1 ? "tomorrow" : `in ${days}d`;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-2 hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {list.map(e => {
        const isToday = e.event_date === today;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e)}
            className={cn(
              "w-[240px] shrink-0 overflow-hidden bg-card border p-4 rounded-lg flex flex-col gap-3 text-left hover:bg-white/[0.03] transition-colors",
              isToday ? "border-white/30" : "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              {e.tag_id ? <TagChip tagId={e.tag_id} /> : <span className="px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-widest font-bold border border-border text-muted-foreground">Event</span>}
              <span className={cn("font-mono tabular-nums text-xs font-semibold", isToday ? "text-white" : "text-muted-foreground")}>{when(e)}</span>
            </div>
            <span className="block w-full min-w-0 font-medium text-foreground leading-snug line-clamp-2 break-words" title={e.title}>{e.title}</span>
            <span className="text-[11px] text-muted-foreground">
              {isToday ? "Today" : format(parseISO(e.event_date), "EEE d MMM")}{e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ""}
            </span>
          </button>
        );
      })}
      {!list.length && (
        <p className="text-xs text-white/30 italic py-6 px-2">No upcoming Study events.</p>
      )}
    </div>
  );
}
