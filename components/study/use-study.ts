"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StudyDeadline, StudyMaterial, StudyModule } from "@/lib/types";

/** The logged-in person's study modules and deadlines, with save helpers. */
export function useStudy(person: string | null) {
  const [modules, setModules] = useState<StudyModule[]>([]);
  const [deadlines, setDeadlines] = useState<StudyDeadline[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);

  useEffect(() => {
    if (!person) return;
    (async () => {
      const [mods, dls, mats] = await Promise.all([
        supabase.from("study_modules").select("*").eq("person", person).order("created_at"),
        supabase.from("study_deadlines").select("*").eq("person", person).order("cutoff_on"),
        supabase.from("study_materials").select("*").eq("person", person).order("created_at"),
      ]);
      if (mods.error) console.error("Failed to load study modules:", mods.error);
      else setModules(mods.data as StudyModule[]);
      if (dls.error) console.error("Failed to load deadlines:", dls.error);
      else setDeadlines(dls.data as StudyDeadline[]);
      if (mats.error) console.error("Failed to load materials:", mats.error);
      else setMaterials(mats.data as StudyMaterial[]);
    })();
  }, [person]);

  const addModule = useCallback(async (m: Pick<StudyModule, "name" | "color" | "kind">) => {
    const { data, error } = await supabase.from("study_modules").insert({ ...m, person }).select().single();
    if (error) throw error;
    setModules(prev => [...prev, data as StudyModule]);
    return data as StudyModule;
  }, [person]);

  const updateModule = useCallback(async (id: string, updates: Partial<StudyModule>) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    const { error } = await supabase.from("study_modules").update(updates).eq("id", id);
    if (error) console.error("Failed to save module:", error);
  }, []);

  // Deleting a module also deletes its deadlines (the database cascades).
  const deleteModule = useCallback(async (id: string) => {
    setModules(prev => prev.filter(m => m.id !== id));
    setDeadlines(prev => prev.filter(d => d.module_id !== id));
    setMaterials(prev => prev.filter(m => m.module_id !== id));
    const { error } = await supabase.from("study_modules").delete().eq("id", id);
    if (error) console.error("Failed to delete module:", error);
  }, []);

  const addDeadline = useCallback(async (d: Omit<StudyDeadline, "id" | "person" | "created_at" | "done" | "score" | "note">) => {
    const { data, error } = await supabase.from("study_deadlines").insert({ ...d, person }).select().single();
    if (error) throw error;
    setDeadlines(prev => [...prev, data as StudyDeadline]);
    return data as StudyDeadline;
  }, [person]);

  const updateDeadline = useCallback(async (id: string, updates: Partial<StudyDeadline>) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    const { error } = await supabase.from("study_deadlines").update(updates).eq("id", id);
    if (error) console.error("Failed to save deadline:", error);
  }, []);

  const deleteDeadline = useCallback(async (id: string) => {
    setDeadlines(prev => prev.filter(d => d.id !== id));
    const { error } = await supabase.from("study_deadlines").delete().eq("id", id);
    if (error) console.error("Failed to delete deadline:", error);
  }, []);

  const addMaterial = useCallback(async (m: Omit<StudyMaterial, "id" | "person" | "created_at" | "current">) => {
    const { data, error } = await supabase.from("study_materials").insert({ ...m, person }).select().single();
    if (error) throw error;
    setMaterials(prev => [...prev, data as StudyMaterial]);
  }, [person]);

  const updateMaterial = useCallback(async (id: string, updates: Partial<StudyMaterial>) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    const { error } = await supabase.from("study_materials").update(updates).eq("id", id);
    if (error) console.error("Failed to save material:", error);
  }, []);

  const deleteMaterial = useCallback(async (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from("study_materials").delete().eq("id", id);
    if (error) console.error("Failed to delete material:", error);
  }, []);

  return { person, modules, deadlines, materials, addMaterial, updateMaterial, deleteMaterial, addModule, updateModule, deleteModule, addDeadline, updateDeadline, deleteDeadline };
}

export type StudyData = ReturnType<typeof useStudy>;
