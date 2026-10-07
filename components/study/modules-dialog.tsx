"use client";

import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_COLORS } from "@/lib/study";
import { StudyModule } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StudyData } from "./use-study";
import { FieldLabel, ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

/** Add, rename, recolour or delete your modules. */
export function ModulesDialog({ study, onClose, startAdding }: { study: StudyData; onClose: () => void; startAdding?: boolean }) {
  const [editing, setEditing] = useState<StudyModule | "new" | null>(startAdding || !study.modules.length ? "new" : null);
  const [toDelete, setToDelete] = useState<StudyModule | null>(null);

  return (
    <StudyModal title="Modules" onClose={onClose}>
      {editing ? (
        <ModuleForm
          study={study}
          module={editing === "new" ? null : editing}
          onDone={() => (study.modules.length || editing !== "new" ? setEditing(null) : onClose())}
        />
      ) : (
        <>
          <div className="flex flex-col">
            {study.modules.map(m => {
              const count = study.deadlines.filter(d => d.module_id === m.id).length;
              return (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-white/[0.06] group">
                  <ModuleDot module={m} />
                  <span className="text-sm flex-1 min-w-0 truncate">{m.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/30">{m.kind === "self" ? "Self-study" : "Course"} · {count} deadline{count === 1 ? "" : "s"}</span>
                  <button type="button" onClick={() => setEditing(m)} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10" title="Edit module">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setToDelete(m)} className="p-1.5 rounded-md text-red-500/50 hover:text-red-500 hover:bg-red-500/10" title="Delete module">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setEditing("new")} className="w-full py-3 border border-dashed border-border rounded-lg text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-white hover:border-white/20 transition-colors">
            + Add module
          </button>
        </>
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) study.deleteModule(toDelete.id); setToDelete(null); }}
        title="Delete Module?"
        description={`This also deletes every deadline and material in ${toDelete?.name ?? "this module"}. This action cannot be undone.`}
      />
    </StudyModal>
  );
}

function ModuleForm({ study, module, onDone }: { study: StudyData; module: StudyModule | null; onDone: () => void }) {
  const taken = study.modules.map(m => m.color);
  const [name, setName] = useState(module?.name ?? "");
  const [color, setColor] = useState(module?.color ?? MODULE_COLORS.find(c => !taken.includes(c)) ?? MODULE_COLORS[0]);
  const [kind, setKind] = useState<StudyModule["kind"]>(module?.kind ?? "course");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (module) await study.updateModule(module.id, { name: name.trim(), color, kind });
      else await study.addModule({ name: name.trim(), color, kind });
      onDone();
    } catch (err) {
      console.error("Failed to save module:", err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input
        type="text"
        placeholder="e.g. MST124"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
      />
      <div className="flex flex-col gap-2">
        <FieldLabel>Colour</FieldLabel>
        <div className="flex flex-wrap gap-2.5">
          {MODULE_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn("w-7 h-7 rounded-full border-2 transition-transform", color === c ? "border-white scale-110" : "border-transparent hover:scale-105")}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Kind</FieldLabel>
        <div className="flex gap-2">
          <OptionPill active={kind === "course"} onClick={() => setKind("course")}>Course module</OptionPill>
          <OptionPill active={kind === "self"} onClick={() => setKind("self")}>Self-study</OptionPill>
        </div>
      </div>
      <button type="submit" disabled={!name.trim() || saving} className={primaryButton}>{module ? "Save" : "Add module"}</button>
    </form>
  );
}
