import { endOfMonth, startOfMonth } from "date-fns";
import { supabase } from "./supabase";
import { StudySession, studiedSeconds } from "./study-sessions";
import { StudyModule } from "./types";

// One person's finished study sessions started between two moments, oldest first.
export async function fetchStudySessions(person: string, from: Date, to: Date): Promise<StudySession[]> {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("person", person)
    .gte("started_at", from.toISOString())
    .lte("started_at", to.toISOString())
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true });
  if (error) { console.error("Failed to load study sessions:", error); return []; }
  return (data ?? []) as StudySession[];
}

export const fetchMonthStudySessions = (person: string, date: Date) =>
  fetchStudySessions(person, startOfMonth(date), endOfMonth(date));

/** Hours actually studied (pauses taken out). */
export function studiedHours(sessions: StudySession[]) {
  return sessions.reduce((acc, s) => acc + studiedSeconds(s), 0) / 3600;
}

// One box in the Modules section: a course module, all self-study, or Other.
export interface ModuleGroup {
  key: string;
  name: string;
  color: string;
  sessions: StudySession[];
  hours: number;
}

const SELF_COLOR = "#a78bfa";
export const OTHER_STUDY_COLOR = "#555553";

/**
 * The Modules section's boxes: the two course modules studied most this month
 * (newest first on a tie, so a fresh term's modules show before any study),
 * then all self-study modules together, then Other (no module, or one since
 * deleted).
 */
export function moduleGroups(sessions: StudySession[], modules: StudyModule[]): ModuleGroup[] {
  const of = (ids: string[]) => sessions.filter((s) => s.module_id !== null && ids.includes(s.module_id));
  const group = (key: string, name: string, color: string, list: StudySession[]): ModuleGroup =>
    ({ key, name, color, sessions: list, hours: studiedHours(list) });

  const courses = modules
    .filter((m) => m.kind === "course")
    .map((m) => group(m.id, m.name, m.color, of([m.id])))
    .sort((a, b) => b.hours - a.hours || modules.findIndex((m) => m.id === b.key) - modules.findIndex((m) => m.id === a.key))
    .slice(0, 2);
  const self = modules.filter((m) => m.kind === "self");
  const known = new Set(modules.map((m) => m.id));

  return [
    ...courses,
    group("self", "Self-study", self[0]?.color ?? SELF_COLOR, of(self.map((m) => m.id))),
    group("other", "Other", OTHER_STUDY_COLOR, sessions.filter((s) => !s.module_id || !known.has(s.module_id))),
  ];
}

// Session types, in the order a module's work usually goes.
export const KINDS: { kind: StudySession["kind"]; label: string; color: string }[] = [
  { kind: "material", label: "Material", color: "#3987e5" },
  { kind: "deadline", label: "Deadline", color: "#d95926" },
  { kind: "revision", label: "Revision", color: "#199e70" },
  { kind: "practice", label: "Practice", color: "#c98500" },
  { kind: "other", label: "Something else", color: "#8a8f98" },
  { kind: "general", label: "General", color: OTHER_STUDY_COLOR },
];
