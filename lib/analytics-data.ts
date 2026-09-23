import { addDays, endOfDay, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "./supabase";
import type { WorkSession } from "./work-sessions";
import type { MetricComparison } from "@/components/metric-card";

// This month's finished sessions, newest first.
export async function fetchMonthSessions(date: Date): Promise<WorkSession[]> {
  const { data, error } = await supabase
    .from("work_sessions")
    .select("id, person, task, started_at, ended_at, duration")
    .gte("started_at", startOfMonth(date).toISOString())
    .lte("started_at", endOfMonth(date).toISOString())
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });
  if (error || !data) return [];
  return data as WorkSession[];
}

// Hours logged between two moments (finished sessions only).
export async function fetchHoursBetween(from: Date, to: Date): Promise<number> {
  const { data, error } = await supabase
    .from("work_sessions")
    .select("duration")
    .gte("started_at", from.toISOString())
    .lte("started_at", to.toISOString())
    .not("ended_at", "is", null);
  if (error || !data) return 0;
  return data.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;
}

// When clocking in first started, across everyone.
export async function fetchFirstSessionAt(): Promise<string | null> {
  const { data } = await supabase
    .from("work_sessions")
    .select("started_at")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.started_at ?? null;
}

// Arrows compare this month so far with the same days of last month, e.g.
// 1–23 Oct vs 1–23 Sep. subMonths clamps, so 31 Mar compares with 1–28 Feb.
export function comparisonWindow(now: Date) {
  const cutoff = subMonths(now, 1);
  cutoff.setHours(12, 0, 0, 0);
  return {
    cutoff,
    start: startOfMonth(cutoff),
    end: endOfDay(cutoff),
    soldBy: format(cutoff, "yyyy-MM-dd"),
    label: cutoff.getDate() === 1
      ? `vs ${format(cutoff, "MMM")} 1`
      : `vs ${format(cutoff, "MMM")} 1–${format(cutoff, "d")}`,
  };
}

// Hours arrows need clocking to have covered all of last month.
export function hoursCoverLastMonth(firstSessionAt: string | null, lastMonthStart: Date) {
  return !!firstSessionAt && new Date(firstSessionAt) < addDays(lastMonthStart, 3);
}

export type Tone = "more-is-good" | "neutral";

export function makeComparison(
  current: number,
  previous: number | null | undefined,
  tone: Tone,
  comparable: boolean,
  label: string
): MetricComparison | null {
  if (!comparable || previous === undefined || previous === null || previous === 0) return null;
  const diff = current - previous;
  const up = diff >= 0;
  return {
    percentage: Math.abs((diff / previous) * 100),
    direction: up ? "up" : "down",
    // Costs and hours rising isn't good or bad on its own (more stock, more
    // sales, more work), so those arrows stay grey.
    tone: tone === "neutral" ? "neutral" : up ? "good" : "bad",
    label,
  };
}

// Hours per task for the Top Task card and its breakdown, biggest first.
export function hoursByTask(sessions: WorkSession[]) {
  const totals = new Map<string, number>();
  sessions.forEach((s) => totals.set(s.task, (totals.get(s.task) || 0) + (s.duration || 0) / 3600));
  return [...totals.entries()].map(([task, hours]) => ({ task, hours })).sort((a, b) => b.hours - a.hours);
}
