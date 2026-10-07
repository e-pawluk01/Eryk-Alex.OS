"use client";

import React, { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MATERIAL_UNITS } from "@/lib/study";
import { StudyMaterial } from "@/lib/types";
import { StudyData } from "./use-study";
import { FieldLabel, ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

/** Add a material, or edit / delete one when `material` is given. */
export function MaterialDialog({ study, material, onClose }: { study: StudyData; material?: StudyMaterial; onClose: () => void }) {
  const [title, setTitle] = useState(material?.title ?? "");
  const [moduleId, setModuleId] = useState(material?.module_id ?? study.modules[0]?.id ?? "");
  const [total, setTotal] = useState(material?.total ? String(material.total) : "");
  const [unit, setUnit] = useState(material?.unit ?? MATERIAL_UNITS[0]);
  const [finishBy, setFinishBy] = useState<string | null>(material?.finish_by ?? null);
  const [pinned, setPinned] = useState(material?.pinned ?? true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalNum = parseInt(total) || null;
  const canSave = title.trim() && moduleId && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const fields = {
      title: title.trim(),
      module_id: moduleId,
      total: totalNum,
      unit: totalNum ? unit : null,
      finish_by: totalNum ? finishBy : null,
      pinned: totalNum ? pinned : false,
    };
    try {
      if (material) await study.updateMaterial(material.id, { ...fields, current: Math.min(material.current, totalNum ?? material.current) });
      else await study.addMaterial(fields);
      onClose();
    } catch (err) {
      console.error("Failed to save material:", err);
      setSaving(false);
    }
  };

  return (
    <StudyModal title={material ? "Edit material" : "Add material"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <input
          type="text"
          placeholder="e.g. Book A"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
        />

        <div className="flex flex-col gap-2">
          <FieldLabel>Module</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {study.modules.map(m => (
              <OptionPill key={m.id} active={moduleId === m.id} onClick={() => setModuleId(m.id)}>
                <ModuleDot module={m} />{m.name}
              </OptionPill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Total · optional</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 280"
              value={total}
              onChange={e => setTotal(e.target.value.replace(/\D/g, ""))}
              className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/30 font-mono"
            />
            {MATERIAL_UNITS.map(u => (
              <OptionPill key={u} active={unit === u} onClick={() => setUnit(u)}>{u}</OptionPill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Show its bar on Study home?</FieldLabel>
          <div className="flex gap-2">
            <OptionPill active={!!totalNum && pinned} onClick={() => totalNum && setPinned(true)}>Yes, pin it</OptionPill>
            <OptionPill active={!totalNum || !pinned} onClick={() => setPinned(false)}>No</OptionPill>
          </div>
          {!totalNum && <span className="text-[11px] text-white/30">Needs a total to show a bar.</span>}
        </div>

        {totalNum && (
          <>
            <div className="flex flex-col gap-2">
              <FieldLabel>Finish by · optional</FieldLabel>
              <div className="text-xs">
                <DatePicker value={finishBy} onChange={setFinishBy} placeholder="No target date" icon={<CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />} />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          {material && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-3 hover:bg-red-500/20 rounded-lg transition-colors text-red-500/50 hover:text-red-500 shrink-0"
              title="Delete Material"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="submit" disabled={!canSave} className={primaryButton}>{material ? "Save" : "Add"}</button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { if (material) study.deleteMaterial(material.id); setConfirmDelete(false); onClose(); }}
        title="Delete Material?"
        description="Are you sure you want to delete this material and its progress? This action cannot be undone."
      />
    </StudyModal>
  );
}

/** "Where are you up to?" — type the page (or chapter, lecture) you're on. */
export function ProgressDialog({ study, material, onClose }: { study: StudyData; material: StudyMaterial; onClose: () => void }) {
  const [value, setValue] = useState(String(material.current));
  const module = study.modules.find(m => m.id === material.module_id);
  const num = Math.max(0, Math.min(material.total ?? 0, parseInt(value) || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    study.updateMaterial(material.id, { current: num });
    onClose();
  };

  return (
    <StudyModal title="Where are you up to?" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><ModuleDot module={module} />{material.title}</span>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
            onFocus={e => e.target.select()}
            autoFocus
            className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/30 font-mono tabular-nums"
          />
          <span className="font-mono text-xs text-muted-foreground">/ {material.total} {material.unit}</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${material.total ? (num / material.total) * 100 : 0}%`, background: module?.color }} />
        </div>
        <button type="submit" className={primaryButton}>Save</button>
      </form>
    </StudyModal>
  );
}
