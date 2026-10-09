"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { TASK_COLORS } from "@/lib/work-sessions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Reusable coloured labels for events and tasks. One shared list for both of you.
export interface Tag {
  id: string;
  name: string;
  color: string; // hex
  created_at: string;
}

// Same colour set as the Work charts.
export const TAG_COLORS = Object.values(TASK_COLORS);

interface TagsContextValue {
  tags: Tag[];
  addTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, updates: Partial<Pick<Tag, "name" | "color">>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

const TagsContext = createContext<TagsContextValue>({
  tags: [],
  addTag: async () => { throw new Error("No tags provider"); },
  updateTag: async () => {},
  deleteTag: async () => {},
});

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    supabase.from("tags").select("*").order("created_at").then(({ data, error }) => {
      if (error) console.error("Failed to load tags:", error);
      else setTags(data as Tag[]);
    });
  }, []);

  const addTag = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase.from("tags").insert({ name, color }).select().single();
    if (error) throw error;
    setTags(prev => [...prev, data as Tag]);
    return data as Tag;
  }, []);

  const updateTag = useCallback(async (id: string, updates: Partial<Pick<Tag, "name" | "color">>) => {
    setTags(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    const { error } = await supabase.from("tags").update(updates).eq("id", id);
    if (error) console.error("Failed to save tag:", error);
  }, []);

  // Items that used the tag keep everything else; the database clears their tag.
  const deleteTag = useCallback(async (id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) console.error("Failed to delete tag:", error);
  }, []);

  return <TagsContext.Provider value={{ tags, addTag, updateTag, deleteTag }}>{children}</TagsContext.Provider>;
}

export const useTags = () => useContext(TagsContext);

/** The coloured label. Renders nothing when there's no (or a deleted) tag. */
export function TagChip({ tagId, className }: { tagId: string | null | undefined; className?: string }) {
  const { tags } = useTags();
  const tag = tags.find(t => t.id === tagId);
  if (!tag) return null;
  return (
    <span
      className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-widest font-bold border whitespace-nowrap shrink-0", className)}
      style={{ color: tag.color, borderColor: `${tag.color}66`, background: `${tag.color}12` }}
    >
      {tag.name}
    </span>
  );
}

const pill = (active: boolean) =>
  cn(
    "inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors",
    active ? "text-white bg-white/[0.06]" : "border-border text-muted-foreground hover:text-white hover:border-white/20"
  );

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAG_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          className={cn("w-6 h-6 rounded-full border-2 transition-transform", value === c ? "border-white scale-110" : "border-transparent hover:scale-105")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/** Pick a tag, make a new one, or open the tag manager. */
export function TagPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { tags, addTag } = useTags();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [managing, setManaging] = useState(false);
  const [saving, setSaving] = useState(false);

  const startCreating = () => {
    const used = tags.map(t => t.color);
    setColor(TAG_COLORS.find(c => !used.includes(c)) ?? TAG_COLORS[0]);
    setName("");
    setCreating(true);
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const tag = await addTag(name.trim(), color);
      onChange(tag.id);
      setCreating(false);
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        {tags.map(t => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} className={pill(value === t.id)} style={value === t.id ? { borderColor: t.color } : undefined}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
        <button type="button" onClick={() => onChange(null)} className={cn(pill(value === null), value === null && "border-white/35")}>No tag</button>
        {!creating && (
          <button type="button" onClick={startCreating} className="inline-flex text-xs px-3 py-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-white">
            + New tag
          </button>
        )}
        {tags.length > 0 && !creating && (
          <button type="button" onClick={() => setManaging(true)} className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10" title="Edit tags" aria-label="Edit tags">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {creating && (
        <div className="flex flex-col gap-3 border border-white/10 rounded-lg p-3 bg-black/30">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
            placeholder="Tag name, e.g. Lecture"
            autoFocus
            className="bg-transparent border-b border-white/10 pb-1.5 text-sm text-white outline-none focus:border-white/30"
          />
          <ColorSwatches value={color} onChange={setColor} />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={!name.trim() || saving} className="px-3 py-1.5 bg-white text-black rounded-lg text-[10px] uppercase tracking-widest font-bold disabled:opacity-50">Save tag</button>
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-white/50 hover:text-white">Cancel</button>
          </div>
        </div>
      )}
      {managing && <TagManager onClose={() => setManaging(false)} />}
    </div>
  );
}

/** Rename, recolour or delete tags. */
export function TagManager({ onClose }: { onClose: () => void }) {
  const { tags, updateTag, deleteTag } = useTags();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [toDelete, setToDelete] = useState<Tag | null>(null);

  const startEdit = (t: Tag) => { setEditing(t.id); setName(t.name); setColor(t.color); };
  const saveEdit = async () => {
    if (!editing || !name.trim()) return;
    await updateTag(editing, { name: name.trim(), color });
    setEditing(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-zinc-950/90 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-md shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300">
        <div className="flex items-center justify-between px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Tags</span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 pb-6 flex flex-col">
          {tags.map(t => (
            editing === t.id ? (
              <div key={t.id} className="flex flex-col gap-3 py-3 border-b border-white/[0.06]">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } }}
                  autoFocus
                  className="bg-transparent border-b border-white/10 pb-1.5 text-sm text-white outline-none focus:border-white/30"
                />
                <ColorSwatches value={color} onChange={setColor} />
                <div className="flex gap-2">
                  <button type="button" onClick={saveEdit} className="px-3 py-1.5 bg-white text-black rounded-lg text-[10px] uppercase tracking-widest font-bold">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-white/50 hover:text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.06]">
                <TagChip tagId={t.id} className="text-[10px]" />
                <span className="flex-1" />
                <button type="button" onClick={() => startEdit(t)} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10" title="Rename or recolour">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setToDelete(t)} className="p-1.5 rounded-md text-red-500/50 hover:text-red-500 hover:bg-red-500/10" title="Delete tag">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          ))}
          {!tags.length && <p className="text-xs text-white/30 italic py-2">No tags yet.</p>}
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteTag(toDelete.id); setToDelete(null); }}
        title="Delete Tag?"
        description={`"${toDelete?.name ?? ""}" will be removed from everything that uses it. The events and tasks themselves stay.`}
      />
    </div>,
    document.body
  );
}
