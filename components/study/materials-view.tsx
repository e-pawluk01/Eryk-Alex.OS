"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { paceLine, progressText } from "@/lib/study";
import { StudyMaterial } from "@/lib/types";
import { StudyData } from "./use-study";
import { ModuleDot } from "./bits";
import { MaterialDialog, ProgressDialog } from "./material-dialogs";
import { ModulesDialog } from "./modules-dialog";

/** One material: name, where you're up to, and a bar in the module's colour. Click to update. */
export function MaterialCard({ study, material, full, onUpdate, onEdit }: {
  study: StudyData;
  material: StudyMaterial;
  full?: boolean;
  onUpdate: () => void;
  onEdit?: () => void;
}) {
  const module = study.modules.find(m => m.id === material.module_id);
  const pct = material.total ? Math.min(100, (material.current / material.total) * 100) : 0;
  const finished = !!material.total && material.current >= material.total;
  const pace = full ? paceLine(material) : null;

  return (
    <div className={cn("group bg-card border border-border rounded-lg p-3.5 flex flex-col gap-2.5 hover:border-white/20 transition-colors", finished && "opacity-60")}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onUpdate} className="flex items-center gap-2 min-w-0 text-left text-sm">
          {full && <ModuleDot module={module} />}
          <span className="truncate">{material.title}</span>
        </button>
        <span className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{finished ? "finished" : progressText(material)}</span>
          {full && material.total && (
            <button
              type="button"
              onClick={() => study.updateMaterial(material.id, { pinned: !material.pinned })}
              className={cn(
                "text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border transition-colors",
                material.pinned ? "text-white border-white/30" : "text-white/30 border-border hover:text-white"
              )}
              title="Show on Study home"
            >
              {material.pinned ? "On home" : "Pin"}
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all" title="Edit material">
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>
      {material.total && (
        <button type="button" onClick={onUpdate} className="block w-full h-1 rounded-full bg-white/[0.08] overflow-hidden" aria-label="Update progress">
          <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: module?.color }} />
        </button>
      )}
      {pace && <span className="text-[10.5px] text-muted-foreground tabular-nums">{pace}</span>}
    </div>
  );
}

/** Full Materials page, opened from the Study side tab. Grouped by module. */
export function MaterialsView({ study }: { study: StudyData }) {
  const [updating, setUpdating] = useState<StudyMaterial | null>(null);
  const [editing, setEditing] = useState<StudyMaterial | "new" | null>(null);
  const [addingModule, setAddingModule] = useState(false);

  const isFinished = (m: StudyMaterial) => !!m.total && m.current >= m.total;
  const groups = study.modules
    .map(mod => ({
      mod,
      items: study.materials.filter(m => m.module_id === mod.id).sort((a, b) => Number(isFinished(a)) - Number(isFinished(b))),
    }))
    .filter(g => g.items.length);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Materials</h2>
      </div>

      {groups.map(({ mod, items }) => (
        <section key={mod.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold"><ModuleDot module={mod} />{mod.name}</h3>
            <div className="h-px bg-border flex-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map(m => (
              <MaterialCard
                key={m.id}
                study={study}
                material={m}
                full
                onUpdate={() => (m.total ? setUpdating(m) : setEditing(m))}
                onEdit={() => setEditing(m)}
              />
            ))}
          </div>
        </section>
      ))}

      {!groups.length && (
        <p className="text-xs text-white/30 italic">
          {study.modules.length ? "No materials yet. Add a book, lecture series or course to track your progress." : "Add your modules first, then your materials."}
        </p>
      )}

      <button
        type="button"
        onClick={() => (study.modules.length ? setEditing("new") : setAddingModule(true))}
        className="w-full py-3 border border-dashed border-border rounded-lg text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-white hover:border-white/20 transition-colors"
      >
        {study.modules.length ? "+ Add material" : "+ Add a module"}
      </button>

      {updating && <ProgressDialog study={study} material={updating} onClose={() => setUpdating(null)} />}
      {editing && <MaterialDialog study={study} material={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {addingModule && <ModulesDialog study={study} startAdding onClose={() => setAddingModule(false)} />}
    </div>
  );
}

/** Study home row: bars for the materials you've pinned. Hidden when none are. */
export function WorkingThrough({ study }: { study: StudyData }) {
  const [updating, setUpdating] = useState<StudyMaterial | null>(null);
  const pinned = study.materials.filter(m => m.pinned && m.total);
  if (!pinned.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Working through</h3>
        <div className="h-px bg-border flex-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pinned.map(m => <MaterialCard key={m.id} study={study} material={m} onUpdate={() => setUpdating(m)} />)}
      </div>
      {updating && <ProgressDialog study={study} material={updating} onClose={() => setUpdating(null)} />}
    </section>
  );
}
