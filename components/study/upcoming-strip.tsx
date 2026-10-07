"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { byCutoff, daysUntil, shortDate, shortTime, urgency, URGENCY_BORDER } from "@/lib/study";
import { StudyData } from "./use-study";
import { Countdown, ModuleDot, OpenTag, TypeChip, WindowBar } from "./bits";
import { DeadlinePanel } from "./deadline-panel";
import { DeadlineDialog } from "./deadline-dialog";
import { ModulesDialog } from "./modules-dialog";

/** Study home's top strip (where Goals sit in Work): the next deadlines by cut-off. */
export function UpcomingStrip({ study }: { study: StudyData }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const upcoming = study.deadlines.filter(d => !d.done).sort(byCutoff).slice(0, 8);
  const open = study.deadlines.find(d => d.id === openId) ?? null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Upcoming</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 px-2 hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {upcoming.map(d => {
          const module = study.modules.find(m => m.id === d.module_id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setOpenId(d.id)}
              className={cn(
                "w-[240px] shrink-0 bg-card border p-4 rounded-lg flex flex-col gap-3 text-left hover:bg-white/[0.03] transition-colors",
                URGENCY_BORDER[urgency(daysUntil(d.cutoff_on))]
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><TypeChip type={d.type} module={module} /><OpenTag deadline={d} /></span>
                <Countdown deadline={d} className="text-xs font-semibold" />
              </div>
              <div className="flex items-center gap-2 font-medium text-foreground min-w-0">
                <ModuleDot module={module} />
                <span className="truncate">{d.title}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {d.opens_on ? "Cut-off " : ""}{shortDate(d.cutoff_on)}{shortTime(d.cutoff_time) ? ` · ${shortTime(d.cutoff_time)}` : ""}
              </span>
              <WindowBar deadline={d} module={module} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-[240px] shrink-0 flex items-center justify-center gap-2 py-4 border border-dashed border-border rounded-lg text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors group"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs uppercase tracking-widest font-semibold">New Deadline</span>
        </button>
      </div>

      <DeadlinePanel study={study} deadline={open} onClose={() => setOpenId(null)} />
      {adding && <DeadlineDialog study={study} onClose={() => setAdding(false)} onNeedModule={() => { setAdding(false); setAddingModule(true); }} />}
      {addingModule && <ModulesDialog study={study} startAdding onClose={() => setAddingModule(false)} />}
    </section>
  );
}
