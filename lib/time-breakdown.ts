import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfMonth, startOfMonth } from "date-fns";

// What the month-close snapshot stores about hours (time_breakdown column),
// so the monthly PDF can show the Time section and its chart.
export interface TimeBreakdown {
  byTask: { task: string; hours: number }[];     // biggest first
  byPerson: { person: string; hours: number }[];
  weeks: { start: number; end: number; tasks: Record<string, number> }[];
}

interface SessionRow {
  task: string;
  person: string;
  started_at: string;
  duration: number | null;
}

// A month's finished sessions — the admin client in the cron job.
export async function fetchSessionsForMonth(client: SupabaseClient, month: Date): Promise<SessionRow[]> {
  const { data, error } = await client
    .from("work_sessions")
    .select("task, person, started_at, duration")
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

  return {
    byTask: sum("task").map(([task, h]) => ({ task, hours: round1(h) })),
    byPerson: sum("person").map(([person, h]) => ({ person, hours: round1(h) })),
    weeks,
  };
}
