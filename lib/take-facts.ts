import type { ReportExtras } from "./report-extras";
import type { TimeBreakdown } from "./time-breakdown";

// The facts sheet behind Claude's monthly take. Every figure, comparison and
// "worth mentioning?" flag is worked out here, in code; the model only writes
// up what this hands it (advisor's rule: all maths in code).
//
// Is a change worth mentioning? It has to pass two tests:
//  - Real: bigger than the normal wobble at this volume. Counts: more than
//    2 × √(this month + normal). Averages and rates: more than 2 standard
//    errors of the difference.
//  - Matters: worth more than one average sale's profit this month.
// And a change only counts as confirmed when last month's take flagged the
// same thing moving the same way; the first time, it goes under "watch".

export type MetricKey =
  | "items_sold" | "average_sale" | "profit_per_sale" | "gross_profit"
  | "sell_through" | "items_added" | "aged_stock" | "days_to_sell";

export const METRIC_NAMES: Record<MetricKey, string> = {
  items_sold: "Items sold",
  average_sale: "Average sale price",
  profit_per_sale: "Profit per sale",
  gross_profit: "Gross profit",
  sell_through: "Sell-through",
  items_added: "Items added",
  aged_stock: "Aged stock",
  days_to_sell: "Days to sell",
};

export interface Sale { sku: string; buy: number; sold: number; fees: number; ship: number; profit: number; note?: string; platform?: string }

export interface Snapshot {
  month: string;                 // "yyyy-MM"
  revenue: number;
  gross_profit: number;
  items_sold: number;
  average_sale_price: number;
  average_profit_per_item: number;
  sales_details: Sale[] | null;
  time_breakdown: TimeBreakdown | null;
}

export interface Metric {
  key: MetricKey;
  value: number | null;
  last: number | null;           // last month (previous take or snapshot)
  normal: number | null;         // average of up to 3 months before
  normalMonths: number;
  change: "up" | "down" | null;  // only when real AND matters
  confirmed: boolean;            // flagged the same way last month too
  money: number | null;          // what the change is worth, £
  n?: number;                    // sell-through only: items it's out of
}

export interface Facts {
  month: string;                 // "yyyy-MM"
  monthName: string;             // "September 2026"
  firstTake: boolean;
  historyMonths: number;         // closed months before this one
  matterLine: number;            // one average sale's profit, £
  verdict: "baseline" | "normal" | "good" | "weak";
  cards: { itemsSold: number; averageSale: number; grossProfit: number; last: { itemsSold: number; averageSale: number; grossProfit: number } | null };
  metrics: Record<MetricKey, Metric>;
  revenueParts: { itemsSold: [number | null, number]; averageSale: [number | null, number]; revenue: [number | null, number] };
  categories: { name: string; sold: number; stocked: number; sellThrough: number; perItem: number; days: number | null; early: boolean; signal: string }[];
  earlyReads: { name: string; sold: number; days: number | null; sellThrough: number }[];
  ladder: { finished: number; live: number } | null;
  platforms: { name: string; sales: number; profit: number }[];
  bought: { from: string; items: number; spend: number }[];
  hoursByTask: { task: string; hours: number }[];
  dataNotes: string[];
  followUps: { do: string; metric: MetricKey; direction: "up" | "down"; before: number | null; now: number | null; result: "moved" | "no change" | "wrong way" | "unknown" }[];
}

export interface PreviousTake {
  month: string;
  facts: Facts;
  actions: { do: string; metric: MetricKey; direction: "up" | "down" }[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const r2 = (v: number) => Math.round(v * 100) / 100;

// Two averages: real if the gap is over 2 standard errors of the difference.
function averageChange(now: number[], before: number[]) {
  if (now.length < 2 || before.length < 2) return { real: false, diff: 0 };
  const diff = mean(now) - mean(before);
  const se = Math.sqrt(sd(now) ** 2 / now.length + sd(before) ** 2 / before.length);
  return { real: Math.abs(diff) > 2 * se, diff };
}

export function buildFacts(input: {
  month: string;
  current: Snapshot;
  history: Snapshot[];                 // closed months before, newest first
  extras: ReportExtras | null;
  previous: PreviousTake | null;
  ladder: { finished: number; live: number } | null;
  bought: { from: string; buy: number }[];
}): Facts {
  const { month, current: cur, history, extras, previous } = input;
  const [y, m] = month.split("-").map(Number);
  const monthName = new Date(Date.UTC(y, m - 1, 2)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const base = history.slice(0, 3);
  const last = history[0] ?? null;
  const sales = cur.sales_details ?? [];
  const baseSales = base.flatMap((s) => s.sales_details ?? []);
  const matterLine = r2(cur.average_profit_per_item || 0);
  const prevMetric = (k: MetricKey) => previous?.facts.metrics[k] ?? null;

  const metric = (key: MetricKey, value: number | null, normal: number | null, lastValue: number | null, real: boolean, money: number | null): Metric => {
    const diff = value !== null && normal !== null ? value - normal : 0;
    const matters = money !== null && Math.abs(money) > matterLine;
    const change = real && matters && diff !== 0 ? (diff > 0 ? "up" : "down") : null;
    const p = prevMetric(key);
    return {
      key, value: value === null ? null : r2(value), last: lastValue === null ? null : r2(lastValue),
      normal: normal === null ? null : r2(normal), normalMonths: base.length,
      change, confirmed: change !== null && p?.change === change, money: money === null ? null : r2(money),
    };
  };

  // Items sold: a count.
  const normalSold = base.length ? mean(base.map((s) => s.items_sold)) : null;
  const soldReal = normalSold !== null && Math.abs(cur.items_sold - normalSold) > 2 * Math.sqrt(cur.items_sold + normalSold);
  const soldMoney = normalSold !== null ? (cur.items_sold - normalSold) * cur.average_profit_per_item : null;

  // Average sale price: an average over each sale.
  const prices = sales.map((s) => s.sold), basePrices = baseSales.map((s) => s.sold);
  const price = averageChange(prices, basePrices);
  const normalPrice = basePrices.length ? mean(basePrices) : null;

  // Profit per sale, each sale capped at the 5th–95th percentile first so one
  // big flip can't make a "change".
  const all = [...sales, ...baseSales].map((s) => s.profit).sort((a, b) => a - b);
  const [p5, p95] = [percentile(all, 0.05), percentile(all, 0.95)];
  const cap = (v: number) => Math.min(p95, Math.max(p5, v));
  const profits = sales.map((s) => cap(s.profit)), baseProfits = baseSales.map((s) => cap(s.profit));
  const profit = averageChange(profits, baseProfits);
  const normalProfit = baseProfits.length ? mean(baseProfits) : null;
  const lastProfits = (last?.sales_details ?? []).map((s) => cap(s.profit));
  const lastProfit = lastProfits.length ? mean(lastProfits) : null;

  // Stock figures only exist from the takes themselves (not in snapshots).
  const h = extras?.health;
  const st = h?.sellThrough;
  const stNow = st?.value ?? null;
  const stDen = st ? st.sold + st.stock + st.removed : 0;
  const stPrev = prevMetric("sell_through")?.value ?? null;
  const stPrevDen = prevMetric("sell_through")?.n ?? 0;
  let stReal = false;
  if (stNow !== null && stPrev !== null && stDen > 0 && stPrevDen > 0) {
    const se = Math.sqrt((stNow * (1 - stNow)) / stDen + (stPrev * (1 - stPrev)) / stPrevDen);
    stReal = Math.abs(stNow - stPrev) > 2 * se;
  }
  const added = h?.added.added ?? null;
  const addedPrev = prevMetric("items_added")?.value ?? null;
  const addedReal = added !== null && addedPrev !== null && Math.abs(added - addedPrev) > 2 * Math.sqrt(added + addedPrev);
  const aged = h?.aged.status === "ready" ? h.aged.count : null;
  const days = h?.daysToSell.status === "ready" && h.daysToSell.reached ? h.daysToSell.median : null;

  const metrics: Record<MetricKey, Metric> = {
    items_sold: metric("items_sold", cur.items_sold, normalSold, last?.items_sold ?? null, soldReal, soldMoney),
    average_sale: metric("average_sale", cur.average_sale_price, normalPrice, last?.average_sale_price ?? null, price.real, price.diff * cur.items_sold),
    profit_per_sale: metric("profit_per_sale", profits.length ? mean(profits) : null, normalProfit, lastProfit, profit.real, profit.diff * cur.items_sold),
    gross_profit: metric("gross_profit", cur.gross_profit, base.length ? mean(base.map((s) => s.gross_profit)) : null, last?.gross_profit ?? null, false, null),
    sell_through: { ...metric("sell_through", stNow, stPrev, stPrev, stReal, stNow !== null && stPrev !== null ? (stNow - stPrev) * stDen * cur.average_profit_per_item : null), n: stDen },
    items_added: metric("items_added", added, addedPrev, addedPrev, addedReal, added !== null && addedPrev !== null ? (added - addedPrev) * cur.average_profit_per_item : null),
    aged_stock: metric("aged_stock", aged, null, prevMetric("aged_stock")?.value ?? null, false, null),
    days_to_sell: metric("days_to_sell", days, null, prevMetric("days_to_sell")?.value ?? null, false, null),
  };

  // Good or weak only on a confirmed change in what drives profit.
  const drivers = (["items_sold", "average_sale", "profit_per_sale"] as MetricKey[]).map((k) => metrics[k]).filter((x) => x.confirmed);
  const gp = metrics.gross_profit;
  const verdict: Facts["verdict"] = !previous || !base.length ? "baseline"
    : drivers.length && gp.normal !== null ? (gp.value! >= gp.normal ? "good" : "weak") : "normal";

  const cats = extras?.ranking.categories.filter((c) => c.name !== "Other") ?? [];
  const categories = cats.map((c) => ({
    name: c.name, sold: c.sold, stocked: c.stocked, sellThrough: r2(c.sellThrough), perItem: r2(c.perItem),
    days: c.daysReached ? c.days : null, early: c.early, signal: c.signal,
  }));
  // At most two early reads, the most promising first.
  const earlyReads = cats.filter((c) => c.early && c.sold > 0).sort((a, b) => b.perItem - a.perItem).slice(0, 2)
    .map((c) => ({ name: c.name, sold: c.sold, days: c.daysReached ? c.days : null, sellThrough: r2(c.sellThrough) }));

  const byPlatform = new Map<string, { sales: number; profit: number }>();
  for (const s of sales) {
    const name = (s.platform ?? "").trim();
    if (!name) continue;
    const p = byPlatform.get(name) ?? { sales: 0, profit: 0 };
    byPlatform.set(name, { sales: p.sales + 1, profit: r2(p.profit + s.profit) });
  }
  const byFrom = new Map<string, { items: number; spend: number }>();
  for (const b of input.bought) {
    const name = b.from.trim() || "Not filled in";
    const p = byFrom.get(name) ?? { items: 0, spend: 0 };
    byFrom.set(name, { items: p.items + 1, spend: r2(p.spend + b.buy) });
  }

  const noPlatform = sales.filter((s) => !(s.platform ?? "").trim()).length;
  const noFrom = input.bought.filter((b) => !b.from.trim()).length;
  const dataNotes: string[] = [];
  if (sales.length && noPlatform === sales.length) dataNotes.push("No sales have a Platform yet, so there's no platform split.");
  else if (noPlatform) dataNotes.push(`${noPlatform} sale${noPlatform === 1 ? " has" : "s have"} no Platform.`);
  if (input.bought.length && noFrom === input.bought.length) dataNotes.push("No stock bought this month has a Sourced From yet, so it's shown as one total.");
  else if (noFrom) dataNotes.push(`${noFrom} item${noFrom === 1 ? "" : "s"} bought this month ${noFrom === 1 ? "has" : "have"} no Sourced From.`);
  if (!base.length) dataNotes.push("No earlier month to compare with.");
  else if (base.length < 3) dataNotes.push(`Normal is based on ${base.length} earlier month${base.length === 1 ? "" : "s"}, not 3 yet.`);

  const followUps: Facts["followUps"] = (previous?.actions ?? []).map((a) => {
    const before = previous!.facts.metrics[a.metric]?.value ?? null;
    const now = metrics[a.metric]?.value ?? null;
    const result = before === null || now === null ? "unknown"
      : now === before ? "no change" : (now > before) === (a.direction === "up") ? "moved" : "wrong way";
    return { ...a, before, now, result };
  });

  return {
    month, monthName, firstTake: !previous, historyMonths: history.length, matterLine, verdict,
    cards: {
      itemsSold: cur.items_sold, averageSale: r2(cur.average_sale_price), grossProfit: r2(cur.gross_profit),
      last: last ? { itemsSold: last.items_sold, averageSale: r2(last.average_sale_price), grossProfit: r2(last.gross_profit) } : null,
    },
    metrics,
    revenueParts: {
      itemsSold: [last?.items_sold ?? null, cur.items_sold],
      averageSale: [last ? r2(last.average_sale_price) : null, r2(cur.average_sale_price)],
      revenue: [last ? r2(last.revenue) : null, r2(cur.revenue)],
    },
    categories, earlyReads,
    ladder: input.ladder,
    platforms: [...byPlatform].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales),
    bought: [...byFrom].map(([from, v]) => ({ from, ...v })).sort((a, b) => b.items - a.items),
    hoursByTask: (cur.time_breakdown?.byTask ?? []).map((t) => ({ task: t.task, hours: Math.round(t.hours * 10) / 10 })),
    dataNotes,
    followUps,
  };
}
