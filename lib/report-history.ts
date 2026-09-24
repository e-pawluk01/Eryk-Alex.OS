import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthPoint } from "./pdf";

// Up to five closed months before `monthKey` ("yyyy-MM"), oldest first, for
// the PDF's revenue and gross profit chart.
export async function fetchReportHistory(client: SupabaseClient, monthKey: string): Promise<MonthPoint[]> {
  const { data, error } = await client
    .from("analytics_monthly_snapshots")
    .select("month, month_label, revenue, gross_profit")
    .lt("month", monthKey)
    .order("month", { ascending: false })
    .limit(5);
  if (error || !data) return [];
  return data.reverse().map((m) => ({
    label: String(m.month_label ?? m.month).split(" ")[0],
    revenue: Number(m.revenue) || 0,
    grossProfit: Number(m.gross_profit) || 0,
  }));
}
