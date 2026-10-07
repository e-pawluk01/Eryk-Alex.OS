import { supabase } from "./supabase";
import { StudyDeadline, StudyMaterial, StudyModule } from "./types";

// One stretch of studying. "What" is one of: general study, a material,
// a deadline, or revision.
export interface StudySession {
  id: string;
  person: string;
  module_id: string;
  kind: "general" | "material" | "deadline" | "revision";
  material_id: string | null;
  deadline_id: string | null;
  started_at: string;
  ended_at: string | null;
  timer_minutes: number | null; // rings when this much time has passed
  created_at: string;
}

// Fired whenever study data changes outside the Study page's own state
// (e.g. clocking out of Study from the Work clock), so it reloads.
export const STUDY_CHANGED_EVENT = "study-changed";
export function notifyStudyChanged() {
  window.dispatchEvent(new Event(STUDY_CHANGED_EVENT));
}

export async function openStudySessionOf(person: string): Promise<StudySession | null> {
  const { data } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("person", person)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as StudySession) ?? null;
}

/** "What" choices for a module, as select values: general, revision, material:<id>, deadline:<id>. */
export function whatOptions(moduleId: string, materials: StudyMaterial[], deadlines: StudyDeadline[], todayIso: string) {
  return {
    materials: materials.filter(m => m.module_id === moduleId && !(m.total && m.current >= m.total)),
    deadlines: deadlines
      .filter(d => d.module_id === moduleId && !d.done && (!d.opens_on || d.opens_on <= todayIso))
      .sort((a, b) => a.cutoff_on.localeCompare(b.cutoff_on)),
  };
}

export function parseWhat(value: string): Pick<StudySession, "kind" | "material_id" | "deadline_id"> {
  if (value.startsWith("material:")) return { kind: "material", material_id: value.slice(9), deadline_id: null };
  if (value.startsWith("deadline:")) return { kind: "deadline", material_id: null, deadline_id: value.slice(9) };
  return { kind: value === "revision" ? "revision" : "general", material_id: null, deadline_id: null };
}

/** Short label for a session: "Book A", "TMA 01", "Revision" or "General". */
export function whatLabel(s: Pick<StudySession, "kind" | "material_id" | "deadline_id">, materials: StudyMaterial[], deadlines: StudyDeadline[]) {
  if (s.kind === "material") return materials.find(m => m.id === s.material_id)?.title ?? "Material";
  if (s.kind === "deadline") return deadlines.find(d => d.id === s.deadline_id)?.title ?? "Deadline";
  return s.kind === "revision" ? "Revision" : "General";
}

export function moduleName(id: string, modules: StudyModule[]) {
  return modules.find(m => m.id === id)?.name ?? "Study";
}

/** "2h 04m" / "45m". */
export function formatDuration(seconds: number) {
  const mins = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** A short three-note chime. Silently does nothing if sound isn't allowed. */
export function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.32);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // sound is optional
  }
}
