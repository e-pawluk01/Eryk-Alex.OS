import { endOfMonth, startOfMonth } from "date-fns";
import { supabase } from "./supabase";
import { StudySession, studiedSeconds } from "./study-sessions";

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
