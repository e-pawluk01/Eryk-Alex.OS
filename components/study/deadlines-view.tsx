"use client";

import React, { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { CURRENT_WITHIN_DAYS, daysUntil, urgency } from "@/lib/study";
import { StudyDeadline } from "@/lib/types";
import { StudyData } from "./use-study";
import { ModuleDot } from "./bits";
import { DeadlinePanel } from "./deadline-panel";
import { DeadlineDialog } from "./deadline-dialog";
import { ModulesDialog } from "./modules-dialog";

const ZOOM_KEY = "deadlines-zoom";
const ZOOMS = [{ weeks: 1, label: "Week" }, { weeks: 2, label: "2 weeks" }, { weeks: 4, label: "4 weeks" }] as const;
type Weeks = (typeof ZOOMS)[number]["weeks"];
const COL_W = 120; // px per column
const DAYS_LEFT = ["text-white/75", "text-white", "text-[#e0a33a]", "text-[#e66767]"];

/**
 * Full Deadlines page, opened from the Study side tab: a Gantt chart from this
 * week on. Each bar runs from when the deadline opens to its cut-off: solid once
 * open, pale before. Done and past deadlines don't show.
 */
export function DeadlinesView({ study }: { study: StudyData }) {
  const [weeks, setWeeks] = useState<Weeks>(1);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(ZOOM_KEY)); if (v === 2 || v === 4) setWeeks(v); } catch { /* optional */ }
  }, []);
  const pickWeeks = (w: Weeks) => {
    setWeeks(w);
    try { localStorage.setItem(ZOOM_KEY, String(w)); } catch { /* optional */ }
  };
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [modulesOpen, setModulesOpen] = useState<false | "list" | "add">(false);
  // The names column fades into the bars once the chart is scrolled sideways.
  const [scrolled, setScrolled] = useState(false);

  const today = startOfDay(new Date());
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const span = 7 * weeks; // days per column
  const px = (date: Date) => (differenceInCalendarDays(date, monday) / span) * COL_W;

  const list = study.deadlines.filter(d =>
    !d.done && daysUntil(d.cutoff_on) >= 0 && (filter === "all" || d.module_id === filter)
  );
  const lastCut = list.reduce((a, d) => (parseISO(d.cutoff_on) > a ? parseISO(d.cutoff_on) : a), monday);
  const cols = Math.max(4, Math.ceil((differenceInCalendarDays(lastCut, monday) + 1) / span) + 1);
  const trackW = cols * COL_W;
  const open = study.deadlines.find(d => d.id === openId) ?? null;

  const bar = (d: StudyDeadline, color: string) => {
    // No start date: assume the weeks before the cut-off the app already counts as "working on".
    const start = d.opens_on ? parseISO(d.opens_on) : addDays(parseISO(d.cutoff_on), -CURRENT_WITHIN_DAYS);
    const notOpen = !!d.opens_on && start > today;
    // Started before this week: an ordinary rounded bar, just clear of the names column.
    const x0 = start < monday ? 6 : px(start);
    const w = Math.max(8, px(addDays(parseISO(d.cutoff_on), 1)) - x0);
    const days = daysUntil(d.cutoff_on);
    const background = notOpen ? `${color}38` : d.opens_on ? color : `linear-gradient(90deg, ${color}00, ${color} 60%)`;
    return (
      <div key={d.id} className="relative h-14">
        <button
          type="button"
          onClick={() => setOpenId(d.id)}
          title={d.title}
          className="absolute top-3 h-8 rounded-lg z-[1] hover:brightness-125 transition-[filter]"
          style={{ left: x0, width: w, background }}
        />
        <span
          className={cn("absolute top-1/2 -translate-y-1/2 font-mono tabular-nums text-xs font-semibold whitespace-nowrap", DAYS_LEFT[urgency(days)])}
          style={{ left: x0 + w + 8 }}
        >
          {days === 0 ? "today" : `${days}d`}
        </span>
      </div>
    );
  };

  const groups = study.modules
    .map(m => ({ module: m, items: list.filter(d => d.module_id === m.id).sort((a, b) => a.cutoff_on.localeCompare(b.cutoff_on)) }))
    .filter(g => g.items.length > 0);

  const sticky = cn(
    "sticky left-0 z-[3] bg-background",
    "after:content-[''] after:absolute after:inset-y-0 after:-right-12 after:w-12 after:pointer-events-none",
    "after:bg-gradient-to-r after:from-background after:to-transparent after:transition-opacity",
    scrolled ? "after:opacity-100" : "after:opacity-0"
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Deadlines</h2>
        <div className="flex gap-1.5">
          {ZOOMS.map(z => (
            <button
              key={z.weeks}
              onClick={() => pickWeeks(z.weeks)}
              className={cn(
                "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all",
                weeks === z.weeks ? "bg-white/15 text-white border-white/30" : "bg-white/[0.03] text-white/40 border-white/10 hover:text-white"
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ id: "all", name: "All" }, ...study.modules].map(m => (
          <button
            key={m.id}
            onClick={() => setFilter(m.id)}
            className={cn(
              "inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors",
              filter === m.id ? "border-white/35 text-white bg-white/[0.06]" : "border-border text-muted-foreground hover:text-white"
            )}
          >
            {"color" in m && <ModuleDot module={m} />}
            {m.name}
          </button>
        ))}
        <button onClick={() => setModulesOpen("list")} className="ml-auto p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="Modules">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-white/30 italic py-4">
          {!study.modules.length ? "Add your modules first, then your deadlines." : "No upcoming deadlines."}
        </p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain" onScroll={e => setScrolled(e.currentTarget.scrollLeft > 2)}>
          <div className="grid grid-cols-[140px_max-content] md:grid-cols-[220px_max-content]">
            {/* Column headings: this week is "Today", then each column's start date */}
            <div className={sticky} />
            <div className="relative h-8" style={{ width: trackW }}>
              {Array.from({ length: cols }, (_, i) => (
                <span
                  key={i}
                  className={cn("absolute inset-y-0 flex items-center pl-2.5 text-[11px] tabular-nums whitespace-nowrap", i === 0 ? "text-white font-semibold" : "text-white/35")}
                  style={{ left: i * COL_W, width: COL_W }}
                >
                  {i === 0 ? "Today" : format(addDays(monday, i * span), "d MMM")}
                </span>
              ))}
            </div>

            {/* Names, grouped by module */}
            <div className={sticky}>
              {groups.map(g => (
                <React.Fragment key={g.module.id}>
                  <div className="h-10 flex items-end gap-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <ModuleDot module={g.module} />{g.module.name}
                  </div>
                  {g.items.map(d => (
                    <button key={d.id} type="button" onClick={() => setOpenId(d.id)} className="h-14 w-full flex items-center pr-4 text-sm text-foreground text-left min-w-0">
                      <span className="truncate" title={d.title}>{d.title}</span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>

            {/* Bars, with week lines, this week shaded and a line for today */}
            <div className="relative" style={{ width: trackW }}>
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: cols }, (_, i) => (
                  <span key={i} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: i * COL_W }} />
                ))}
                <span className="absolute inset-y-0 bg-white/[0.025]" style={{ left: 0, width: COL_W }} />
                <span className="absolute inset-y-0 w-0.5 -ml-px bg-white/60 z-[2]" style={{ left: px(today) + COL_W / span / 2 }} />
              </div>
              {groups.map(g => (
                <React.Fragment key={g.module.id}>
                  <div className="h-10" />
                  {g.items.map(d => bar(d, g.module.color))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => (study.modules.length ? setAdding(true) : setModulesOpen("add"))}
        aria-label="Add a deadline"
        title="Add a deadline"
        className="w-8 h-8 rounded-full border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center mx-auto"
      >
        <Plus className="w-4 h-4" />
      </button>

      <DeadlinePanel study={study} deadline={open} onClose={() => setOpenId(null)} />
      {adding && <DeadlineDialog study={study} onClose={() => setAdding(false)} onNeedModule={() => { setAdding(false); setModulesOpen("add"); }} />}
      {modulesOpen && <ModulesDialog study={study} startAdding={modulesOpen === "add"} onClose={() => setModulesOpen(false)} />}
    </div>
  );
}
