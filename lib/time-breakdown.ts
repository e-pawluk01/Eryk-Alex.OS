import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfMonth, startOfMonth } from "date-fns";

// What the month-close snapshot stores about hours (time_breakdown column),
// so the monthly PDF can show the Time section and its chart.
export interface TimeBreakdown {
  byTask: { task: string; hours: number }[];     // biggest first
  byPerson: { person: string; hours: number }[];
  weeks: { start: number; end: number; tasks: Record<string, number> }[];
  // What the "Other" hours were, by the note typed for them (null: none typed).
  // Missing on snapshots from before it was added.
  other?: { note: string | null; people: string[]; sessions: number; hours: number }[];
}

interface SessionRow {
  task: string;
  person: string;
  started_at: string;
  duration: number | null;
  note?: string | null;
}

// A month's finished sessions — the admin client in the cron job.
export async function fetchSessionsForMonth(client: SupabaseClient, month: Date): Promise<SessionRow[]> {
  const { data, error } = await client
    .from("work_sessions")
    .select("task, person, started_at, duration, note")
    .gte("started_at", startOfMonth(month).toISOString())
    .lte("started_at", endOfMonth(month).toISOString())
    .not("ended_at", "is", null);
  if (error || !data) return [];
  return data as SessionRow[];
}

const round1 = (n: number) => Math.round(n * 100) / 100;

export function buildTimeBreakdown(sessions: SessionRow[], month: Date): TimeBreakdown {
  const hours = (s: SessionRow) => (s.duration || 0) / 3600;
  const sum = (key: "task" | "person") => {
    const totals = new Map<string, number>();
    sessions.forEach((s) => totals.set(s[key], (totals.get(s[key]) || 0) + hours(s)));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  };

  const lastDay = endOfMonth(month).getDate();
  const weeks = [1, 8, 15, 22, 29]
    .filter((start) => start <= lastDay)
    .map((start) => {
      const end = Math.min(start + 6, lastDay);
      const tasks: Record<string, number> = {};
      sessions.forEach((s) => {
        const day = new Date(s.started_at).getDate();
        if (day >= start && day <= end) tasks[s.task] = round1((tasks[s.task] || 0) + hours(s));
      });
      return { start, end, tasks };
    });

  // The same note typed differently ("Bank admin", "bank admin ") is one row.
  const other = new Map<string, { note: string | null; people: Set<string>; sessions: number; hours: number }>();
  sessions.filter((s) => s.task === "Other").forEach((s) => {
    const note = s.note?.trim() || null;
    const key = note?.toLowerCase().replace(/\s+/g, " ") ?? "";
    const row = other.get(key) ?? { note, people: new Set<string>(), sessions: 0, hours: 0 };
    row.people.add(s.person);
    row.sessions += 1;
    row.hours += hours(s);
    other.set(key, row);
  });

  return {
    byTask: sum("task").map(([task, h]) => ({ task, hours: round1(h) })),
    byPerson: sum("person").map(([person, h]) => ({ person, hours: round1(h) })),
    weeks,
    other: [...other.values()]
      .sort((a, b) => b.hours - a.hours)
      .map((r) => ({ note: r.note, people: [...r.people].sort(), sessions: r.sessions, hours: round1(r.hours) })),
  };
}
