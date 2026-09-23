import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, startOfMonth } from "date-fns";

// Clocking in has to have started by the 3rd for a month's hours to count
// as the whole month's work.
const GRACE_DAYS = 3;

/**
 * Hours-based stats (Profit / Hour and friends) only mean something for a
 * month that was clocked from the start. Dividing a whole month's profit by
 * the few hours logged after clocking began gives nonsense like £1,468/hour.
 */
export function isMonthFullyTracked(month: Date, firstSessionAt: string | Date | null): boolean {
  if (!firstSessionAt) return false;
  return new Date(firstSessionAt) < addDays(startOfMonth(month), GRACE_DAYS);
}

/** When clocking in first started, across everyone. */
export async function fetchFirstSessionAt(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("work_sessions")
    .select("started_at")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.started_at as string;
}

/** Profit per hour, or null when the month's hours can't support it. */
export function profitPerHourFor(month: Date, grossProfit: number, hours: number, firstSessionAt: string | null) {
  return isMonthFullyTracked(month, firstSessionAt) && hours > 0 ? grossProfit / hours : null;
}
