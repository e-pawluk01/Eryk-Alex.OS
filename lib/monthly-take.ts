import { supabaseAdmin as supabase } from "./supabase-admin";
import { getMonthlyAnalytics } from "./sheets";
import { buildReportExtras } from "./report-extras";
import { readLadderItems } from "./ladder-sheet";
import { buildFacts, type PreviousTake, type Snapshot } from "./take-facts";
import { writeTake, TAKE_MODEL } from "./take-writer";
import { takeEmailHtml } from "./take-email-html";
import { sendTakeEmail } from "./email";

// Claude's monthly take, start to finish: facts from the month's snapshot,
// earlier snapshots and the sheet → Claude writes it up → number check →
// email to Eryk and Alex → saved in monthly_takes, so next month can compare
// against it and follow up its actions.

const SNAPSHOT_FIELDS = "month, revenue, gross_profit, items_sold, average_sale_price, average_profit_per_item, sales_details, time_breakdown";

const toSnapshot = (r: any): Snapshot => ({
  month: r.month,
  revenue: Number(r.revenue) || 0,
  gross_profit: Number(r.gross_profit) || 0,
  items_sold: Number(r.items_sold) || 0,
  average_sale_price: Number(r.average_sale_price) || 0,
  average_profit_per_item: Number(r.average_profit_per_item) || 0,
  sales_details: Array.isArray(r.sales_details) ? r.sales_details : null,
  time_breakdown: r.time_breakdown ?? null,
});

/**
 * `month` is "yyyy-MM". With `send`, emails it and saves it (once per month
 * unless `force`); without, just returns the email for a preview.
 */
export async function runMonthlyTake(month: string, { send, force = false }: { send: boolean; force?: boolean }) {
  const { data: curRow, error: curError } = await supabase.from("analytics_monthly_snapshots").select(SNAPSHOT_FIELDS).eq("month", month).maybeSingle();
  if (curError) throw new Error(`Couldn't read the ${month} snapshot: ${curError.message}`);
  if (!curRow) throw new Error(`No closed report for ${month} yet, so there's nothing to write about.`);

  const { data: done } = await supabase.from("monthly_takes").select("emailed_at").eq("month", month).maybeSingle();
  if (send && !force && done?.emailed_at) return { skipped: true as const };

  const [{ data: historyRows }, { data: prevRow }] = await Promise.all([
    supabase.from("analytics_monthly_snapshots").select(SNAPSHOT_FIELDS).lt("month", month).order("month", { ascending: false }).limit(12),
    supabase.from("monthly_takes").select("month, facts, written").lt("month", month).not("emailed_at", "is", null).order("month", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const previous: PreviousTake | null = prevRow?.facts
    ? { month: prevRow.month, facts: prevRow.facts, actions: prevRow.written?.actions ?? [] }
    : null;

  const monthDate = new Date(`${month}-02T00:00:00Z`);
  const [extras, sheet, ladder] = await Promise.all([
    buildReportExtras(monthDate),
    getMonthlyAnalytics(monthDate.toISOString()),
    readLadderItems(new Date())
      .then((items) => ({ finished: items.filter((i) => i.stage === "3" || i.stage === "Hold").length, live: items.length }))
      .catch(() => null),
  ]);
  const bought = (sheet.data?.items ?? []).filter((i) => i.sourcedOn?.startsWith(month)).map((i) => ({ from: i.sourcedFrom, buy: i.buy }));

  const facts = buildFacts({
    month, current: toSnapshot(curRow), history: (historyRows ?? []).map(toSnapshot),
    extras, previous, ladder, bought,
  });
  const { written, attempts, failure, raw } = await writeTake(facts);
  const html = takeEmailHtml(facts, written);
  if (!send) return { skipped: false as const, html, facts, written, attempts, failure };

  const result = await sendTakeEmail(`Claude's Take: ${facts.monthName}`, html);
  if (result.error) throw new Error(`Email delivery failed: ${JSON.stringify(result.error)}`);

  // Kept so next month can compare and follow up, and so an odd email can be
  // traced to the data or the model.
  const { error: saveError } = await supabase.from("monthly_takes").upsert({
    month, facts, written, raw, attempts, failure, model: TAKE_MODEL, emailed_at: new Date().toISOString(),
  }, { onConflict: "month" });

  return { skipped: false as const, html, facts, written, attempts, failure, saveError: saveError?.message ?? null };
}
