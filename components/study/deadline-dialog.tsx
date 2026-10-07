"use client";

import React, { useState } from "react";
import { Flag, CalendarClock } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";
import { typesFor } from "@/lib/study";
import { StudyData } from "./use-study";
import { FieldLabel, ModuleDot, OptionPill, primaryButton, StudyModal } from "./bits";

interface DeadlineDialogProps {
  study: StudyData;
  onClose: () => void;
  onNeedModule: () => void;
}

export function DeadlineDialog({ study, onClose, onNeedModule }: DeadlineDialogProps) {
  const types = typesFor(study.person ?? "", study.deadlines);
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState(study.modules[0]?.id ?? "");
  const [type, setType] = useState(types[0] ?? "");
  const [customType, setCustomType] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [cutoffOn, setCutoffOn] = useState<string | null>(null);
  const [cutoffTime, setCutoffTime] = useState("12:00");
  const [opensOn, setOpensOn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finalType = addingType ? customType.trim() : type;
  const canSave = title.trim() && moduleId && finalType && cutoffOn && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await study.addDeadline({
        title: title.trim(),
        module_id: moduleId,
        type: finalType,
        cutoff_on: cutoffOn!,
        cutoff_time: cutoffTime || null,
        opens_on: opensOn && opensOn < cutoffOn! ? opensOn : null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to add deadline:", err);
      setSaving(false);
    }
  };

  if (!study.modules.length) {
    return (
      <StudyModal title="Add a deadline" onClose={onClose}>
        <p className="text-sm text-muted-foreground">Add a module first. Every deadline belongs to one.</p>
        <button type="button" className={primaryButton} onClick={onNeedModule}>Add a module</button>
      </StudyModal>
    );
  }

  return (
    <StudyModal title="Add a deadline" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <input
          type="text"
          placeholder="e.g. TMA 02"
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
          <FieldLabel>Type</FieldLabel>
          <div className="flex flex-wrap gap-2 items-center">
            {types.map(t => (
              <OptionPill key={t} active={!addingType && type === t} onClick={() => { setType(t); setAddingType(false); }}>{t}</OptionPill>
            ))}
            {addingType ? (
              <input
                type="text"
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                placeholder="New type"
                autoFocus
                className="bg-transparent border-b border-white/20 pb-1 text-xs text-white outline-none w-28"
              />
            ) : (
              <OptionPill active={false} onClick={() => setAddingType(true)}>+ New type</OptionPill>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Cut-off</FieldLabel>
          <div className="flex items-center gap-6 text-xs">
            <DatePicker value={cutoffOn} onChange={setCutoffOn} placeholder="Pick a date" icon={<Flag className="w-3.5 h-3.5 text-muted-foreground" />} />
            <TimeField id="cutoff-time" value={cutoffTime} onChange={setCutoffTime} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Opens · optional</FieldLabel>
          <div className="text-xs">
            <DatePicker value={opensOn} onChange={setOpensOn} placeholder="No start date" icon={<CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />} />
          </div>
        </div>

        <button type="submit" disabled={!canSave} className={primaryButton}>Add</button>
      </form>
    </StudyModal>
  );
}
