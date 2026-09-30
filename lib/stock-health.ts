import type { SheetItem } from "./sheet-item";
import { kmMedian } from "./category-ranking";

// The sheet has stamped an Exit Date on every sale and removal since this
// day, so a rolling window can only reach back this far. Until a full 30 days
// are covered, Stock Health uses the current month's tab instead.
export const EXIT_DATES_FROM = "2026-09-22";
const WINDOW_DAYS = 30;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export type Readiness<T> = { status: "collecting" } | ({ status: "ready" } & T);

export interface StockHealth {
  window: { from: string; to: string; rolling: boolean };
  sellThrough: { value: number | null; sold: number; stock: number; removed: number };
  daysToSell: Readiness<{ median: number; reached: boolean; measured: number; listed: number }>;
  aged: Readiness<{ line: number; count: number; cash: number; value: number; oldest: SheetItem[] }>;
  added: { added: number; sold: number; removed: number; net: number; cover: number | null };
}

/**
 * The four Stock Health figures. `current` is this month's tab, `previous`
 * last month's (only its sales and removals are used: its unsold rows are
 * stale copies of what was carried forward).
 */
export function stockHealth(current: SheetItem[], previous: SheetItem[], today = new Date()): StockHealth {
  const to = dayKey(today);
  const rollingFrom = addDays(to, -(WINDOW_DAYS - 1));
  const rolling = rollingFrom >= EXIT_DATES_FROM;
  const from = rolling ? rollingFrom : `${to.slice(0, 8)}01`;
  const inWindow = (key: string | null) => key !== null && key >= from && key <= to;

  // What left stock in the window. On the month's tab, everything that left
  // is this month's, dated or not.
  const exits = rolling
    ? unique([...current, ...previous].filter((i) => i.status !== "stock" && inWindow(i.exitOn)))
    : current.filter((i) => i.status !== "stock");
  const sold = exits.filter((i) => i.status === "sold");
  const removed = exits.filter((i) => i.status === "removed");
  const stock = current.filter((i) => i.status === "stock");

  const total = sold.length + stock.length + removed.length;
  const sellThrough = { value: total ? sold.length / total : null, sold: sold.length, stock: stock.length, removed: removed.length };

  // Days to sell switches on once at least half the window's sales have both
  // a days-listed figure and an exit date.
  const dated = sold.filter((i) => i.days !== null && i.exitOn !== null);
  let daysToSell: StockHealth["daysToSell"] = { status: "collecting" };
  if (sold.length > 0 && dated.length / sold.length >= 0.5) {
    const km = kmMedian([
      ...sold.map((i) => ({ t: i.days, sold: true })),
      ...removed.map((i) => ({ t: i.days, sold: false })),
      ...stock.map((i) => ({ t: i.days, sold: false })),
    ]);
    if (km.median !== null) {
      daysToSell = {
        status: "ready", median: km.median, reached: km.reached,
        measured: sold.filter((i) => i.days !== null).length, listed: stock.filter((i) => i.days !== null).length,
      };
    }
  }

  // Aged stock waits for a real median: twice it is the line.
  let aged: StockHealth["aged"] = { status: "collecting" };
  if (daysToSell.status === "ready" && daysToSell.reached) {
    const line = 2 * daysToSell.median;
    const old = stock.filter((i) => i.days !== null && i.days > line).sort((a, b) => b.days! - a.days!);
    aged = {
      status: "ready", line, count: old.length,
      cash: old.reduce((a, i) => a + i.buy, 0), value: old.reduce((a, i) => a + (i.esp ?? 0), 0),
      oldest: old.slice(0, 10),
    };
  }

  // Added = entered into the sheet in the window (Sourced Date). A carried
  // item appears in both tabs, so each SKU counts once.
  const added = unique([...current, ...previous].filter((i) => inWindow(i.sourcedOn)), true).length;
  const perMonth = sold.length * (WINDOW_DAYS / (daysBetween(from, to) + 1));

  return {
    window: { from, to, rolling },
    sellThrough,
    daysToSell,
    aged,
    added: {
      added, sold: sold.length, removed: removed.length,
      net: added - sold.length - removed.length,
      cover: perMonth > 0 ? stock.length / perMonth : null,
    },
  };
}

// One entry per SKU (rows without a SKU are all kept). With `anyStatus`, a
// SKU seen in both tabs counts once whatever happened to it.
function unique(items: SheetItem[], anyStatus = false): SheetItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.sku.trim().toUpperCase();
    if (!key) return true;
    const id = anyStatus ? key : `${key}|${i.status}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
