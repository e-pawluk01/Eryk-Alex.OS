import { subMonths, endOfMonth, isSameMonth } from "date-fns";
import { getMonthlyAnalytics } from "./sheets";
import { stockHealth, type StockHealth } from "./stock-health";
import { categoryWindow } from "./category-window";
import type { Ranking } from "./category-ranking";
import { categoryOf, hasSku } from "./categories";

// Stock Health, Categories and write-offs for the monthly report, worked out
// from the sheet when the PDF is made (they aren't stored in the snapshot).
export interface ReportExtras {
  writtenOff: number;
  health: StockHealth;
  ranking: Ranking;
  windowLabel: string;
  flips: { sku: string; category: string; paid: number; sold: number; profit: number }[];
}

/** Null if the sheet can't be read: the report then goes out without these pages. */
export async function buildReportExtras(month: Date): Promise<ReportExtras | null> {
  try {
    const [cur, prev, earlier] = await Promise.all([
      getMonthlyAnalytics(month.toISOString()),
      getMonthlyAnalytics(subMonths(month, 1).toISOString()),
      getMonthlyAnalytics(subMonths(month, 2).toISOString()),
    ]);
    if (cur.error || !cur.data) return null;
    const c = cur.data;
    const p = prev.error ? null : prev.data ?? null;
    const e = earlier.error ? null : earlier.data ?? null;

    // A closed month is judged as it stood on its last day.
    const asOf = isSameMonth(month, new Date()) ? new Date() : endOfMonth(month);
    const sales = [...c.salesTable, ...(p?.salesTable ?? []), ...(e?.salesTable ?? [])];
    const { ranking, label } = categoryWindow({
      sales,
      stock: c.stockItems,
      removed: [...c.removedItems, ...(p?.removedItems ?? []), ...(e?.removedItems ?? [])],
    }, asOf);

    return {
      writtenOff: c.writtenOff ?? 0,
      health: stockHealth(c.items, p?.items ?? [], asOf, e?.items ?? []),
      ranking,
      windowLabel: label,
      flips: sales.filter((s: any) => hasSku(s.sku)).sort((a: any, b: any) => b.profit - a.profit).slice(0, 5)
        .map((s: any) => ({ sku: s.sku, category: categoryOf(s.sku, s.note), paid: s.buy, sold: s.sold, profit: s.profit })),
    };
  } catch (err) {
    console.error("Report extras failed; sending the report without them:", err);
    return null;
  }
}
