import { supabase } from "./supabase";
import { StudyDeadline, StudyMaterial, StudyModule } from "./types";

// One stretch of studying: on a module (a material, a deadline or revision),
// or "Other" with a typed description and no module.
export interface StudySession {
  id: string;
  person: string;
  module_id: string | null; // null for "Other"
  kind: "general" | "material" | "deadline" | "revision" | "other"; // "general" only on early sessions
  note: string | null; // what you were doing, for "Other"
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

// The "Other" choice in the module pills (sessions with no module).
export const OTHER = "other";

/** "What" choices for a module, as select values: material:<id>, deadline:<id>, revision. */
export function whatOptions(moduleId: string, materials: StudyMaterial[], deadlines: StudyDeadline[], todayIso: string) {
  return {
    materials: materials.filter(m => m.module_id === moduleId && !(m.total && m.current >= m.total)),
    deadlines: deadlines
      .filter(d => d.module_id === moduleId && !d.done && (!d.opens_on || d.opens_on <= todayIso))
      .sort((a, b) => a.cutoff_on.localeCompare(b.cutoff_on)),
  };
}

/** The first "what" choice for a module: its first material, else its next open deadline, else revision. */
export function firstWhat(moduleId: string, materials: StudyMaterial[], deadlines: StudyDeadline[], todayIso: string) {
  const o = whatOptions(moduleId, materials, deadlines, todayIso);
  if (o.materials[0]) return `material:${o.materials[0].id}`;
  if (o.deadlines[0]) return `deadline:${o.deadlines[0].id}`;
  return "revision";
}

/** The session columns for a module + "what" choice, or for "Other" + typed text. */
export function sessionFields(moduleId: string, what: string, otherText: string): Pick<StudySession, "module_id" | "kind" | "material_id" | "deadline_id" | "note"> {
  if (moduleId === OTHER) return { module_id: null, kind: "other", material_id: null, deadline_id: null, note: otherText.trim() };
  if (what.startsWith("material:")) return { module_id: moduleId, kind: "material", material_id: what.slice(9), deadline_id: null, note: null };
  if (what.startsWith("deadline:")) return { module_id: moduleId, kind: "deadline", material_id: null, deadline_id: what.slice(9), note: null };
  return { module_id: moduleId, kind: "revision", material_id: null, deadline_id: null, note: null };
}

/** Short label for a session: "Book A", "TMA 01", "Revision" or "General". */
export function whatLabel(s: Pick<StudySession, "kind" | "material_id" | "deadline_id" | "note">, materials: StudyMaterial[], deadlines: StudyDeadline[]) {
  if (s.kind === "other") return s.note || "Other";
  if (s.kind === "material") return materials.find(m => m.id === s.material_id)?.title ?? "Material";
  if (s.kind === "deadline") return deadlines.find(d => d.id === s.deadline_id)?.title ?? "Deadline";
  return s.kind === "revision" ? "Revision" : "General";
}

export function moduleName(id: string | null, modules: StudyModule[]) {
  if (!id) return "Other";
  return modules.find(m => m.id === id)?.name ?? "Study";
}

/** "2h 04m" / "45m". */
export function formatDuration(seconds: number) {
  const mins = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Ring until stopped: a bell pattern every 2 seconds, for up to 30 seconds.
 * Returns the function that stops it.
 */
export function startRinging(): () => void {
  playChime();
  const loop = setInterval(playChime, 2000);
  const cap = setTimeout(() => clearInterval(loop), 30000);
  return () => { clearInterval(loop); clearTimeout(cap); };
}

/** One bell pattern: two quick high notes and a lower one. Does nothing if sound isn't allowed. */
export function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ([[0, 988], [0.18, 988], [0.42, 784]] as const).forEach(([t, freq]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.32);
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
