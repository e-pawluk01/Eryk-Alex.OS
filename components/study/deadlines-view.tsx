"use client";

import React, { useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { byCutoff, daysUntil, isOpenNow, shortDate, shortTime, urgency, URGENCY_TEXT } from "@/lib/study";
import { StudyDeadline } from "@/lib/types";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { StudyData } from "./use-study";
import { Countdown, ModuleDot, OpenTag, TypeChip, WindowBar } from "./bits";
import { DeadlinePanel } from "./deadline-panel";
import { DeadlineDialog } from "./deadline-dialog";
import { ModulesDialog } from "./modules-dialog";

// Same columns on every row so names, types, windows, dates and countdowns line up.
const ROW = "grid grid-cols-[16px_10px_minmax(0,1fr)_54px] md:grid-cols-[16px_10px_minmax(0,1fr)_96px_100px_96px_54px] gap-3.5 items-center";

/** Full Deadlines page, opened from the Study side tab. */
export function DeadlinesView({ study }: { study: StudyData }) {
  const [tab, setTab] = useState<"upcoming" | "done">("upcoming");
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [modulesOpen, setModulesOpen] = useState<false | "list" | "add">(false);

  const moduleOf = (d: StudyDeadline) => study.modules.find(m => m.id === d.module_id);
  const inFilter = (d: StudyDeadline) => filter === "all" || d.module_id === filter;
  const list = study.deadlines
    .filter(d => (tab === "done" ? d.done : !d.done) && inFilter(d))
    .sort((a, b) => (tab === "done" ? -byCutoff(a, b) : byCutoff(a, b)));
  const thisWeek = tab === "upcoming" ? list.filter(d => daysUntil(d.cutoff_on) <= 7) : [];
  const later = tab === "upcoming" ? list.filter(d => daysUntil(d.cutoff_on) > 7) : list;
  const next = study.deadlines.filter(d => !d.done && inFilter(d)).sort(byCutoff)[0];
  const open = study.deadlines.find(d => d.id === openId) ?? null;

  const doneCount = (moduleId: string) => {
    const all = study.deadlines.filter(d => moduleId === "all" || d.module_id === moduleId);
    return `${all.filter(d => d.done).length}/${all.length}`;
  };

  const row = (d: StudyDeadline) => {
    const module = moduleOf(d);
    const u = d.done ? "text-muted-foreground" : URGENCY_TEXT[urgency(daysUntil(d.cutoff_on))];
    return (
      <div key={d.id} onClick={() => setOpenId(d.id)} className={cn(ROW, "px-1 py-3 border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.02]")}>
        <span onClick={e => e.stopPropagation()}>
          <CustomCheckbox checked={d.done} onChange={checked => study.updateDeadline(d.id, { done: checked })} />
        </span>
        <ModuleDot module={module} />
        <span className={cn("text-sm truncate", d.done && "text-white/30 line-through")}>{d.title}</span>
        <span className="hidden md:flex"><TypeChip type={d.type} module={module} /></span>
        <span className="hidden md:flex">{d.done ? (d.score ? <span className="text-xs text-muted-foreground">Score {d.score}</span> : null) : <OpenTag deadline={d} />}</span>
        <span className={cn("hidden md:block text-xs text-right tabular-nums whitespace-nowrap", u)}>{shortDate(d.cutoff_on)}</span>
        <span className="text-xs text-right font-semibold">{d.done ? <span className="text-muted-foreground">done</span> : <Countdown deadline={d} />}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Deadlines</h2>
        <div className="flex gap-1.5">
          {(["upcoming", "done"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
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

      {tab === "upcoming" && next && (() => {
        const module = moduleOf(next);
        return (
          <button
            type="button"
            onClick={() => setOpenId(next.id)}
            className="bg-card border rounded-lg p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center text-left hover:bg-white/[0.02] transition-colors"
            style={{ borderColor: `${module?.color ?? "#262626"}55` }}
          >
            <div className="flex flex-col gap-3 min-w-0">
              <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Next up</span>
              <span className="flex items-center gap-2.5 text-xl font-medium text-white min-w-0">
                <ModuleDot module={module} className="w-2.5 h-2.5" />
                <span className="truncate">{next.title}</span>
                <TypeChip type={next.type} module={module} />
              </span>
              <span className="text-xs text-muted-foreground">
                {next.opens_on ? (isOpenNow(next) ? "Open now · cut-off " : `Opens ${shortDate(next.opens_on)} · cut-off `) : ""}
                {shortDate(next.cutoff_on)}{shortTime(next.cutoff_time) ? ` · ${shortTime(next.cutoff_time)}` : ""}
              </span>
              <WindowBar deadline={next} module={module} />
            </div>
            <div className="md:text-right">
              <Countdown deadline={next} className="text-3xl font-semibold leading-none" />
              <span className="block text-[9.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mt-1.5">left</span>
            </div>
          </button>
        );
      })()}

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
            <span className="tabular-nums text-white/30">{doneCount(m.id)}</span>
          </button>
        ))}
        <button onClick={() => setModulesOpen("list")} className="ml-auto p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="Modules">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col">
        {list.length > 0 && (
          <div className={cn(ROW, "px-1 pb-2 border-b border-border text-[9px] uppercase tracking-[0.16em] font-semibold text-white/30")}>
            <span /><span /><span>Name</span>
            <span className="hidden md:block">Type</span>
            <span className="hidden md:block">{tab === "done" ? "Score" : "Window"}</span>
            <span className="hidden md:block text-right">Cut-off</span>
            <span className="text-right">Left</span>
          </div>
        )}
        {thisWeek.length > 0 && <span className="pt-4 pb-1 px-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Next 7 days</span>}
        {thisWeek.map(row)}
        {later.length > 0 && tab === "upcoming" && thisWeek.length > 0 && <span className="pt-4 pb-1 px-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Later</span>}
        {later.map(row)}
        {!list.length && (
          <p className="text-xs text-white/30 italic py-4">
            {!study.modules.length ? "Add your modules first, then your deadlines." : tab === "done" ? "Nothing done yet." : "No upcoming deadlines."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => (study.modules.length ? setAdding(true) : setModulesOpen("add"))}
        className="w-full py-3 border border-dashed border-border rounded-lg text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-white hover:border-white/20 transition-colors"
      >
        {study.modules.length ? "+ Add a deadline" : "+ Add a module"}
      </button>

      <DeadlinePanel study={study} deadline={open} onClose={() => setOpenId(null)} />
      {adding && <DeadlineDialog study={study} onClose={() => setAdding(false)} onNeedModule={() => { setAdding(false); setModulesOpen("add"); }} />}
      {modulesOpen && <ModulesDialog study={study} startAdding={modulesOpen === "add"} onClose={() => setModulesOpen(false)} />}
    </div>
  );
}
