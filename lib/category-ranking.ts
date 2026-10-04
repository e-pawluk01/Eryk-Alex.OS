import { categoryOf, hasSku, isCustomSku } from "./categories";

// Ranks categories fairly even when some are small (the advisor's method,
// Sep 2026). Each category's own figures are blended towards the business
// average by how much data it has: trust = n / (n + k), where k is worked out
// from the data itself. Sale profits are capped at the 5th–95th percentile
// for ranking only, and days to sell count unsold items as "not sold after
// X days so far" (Kaplan–Meier) instead of ignoring them.

export interface RankingInput {
  sales: { sku: string; profit: number; tts: string | number; note?: string }[]; // sold (or bundled) in the window
  stock: { sku: string; days: number | null }[];   // unsold now, with days listed so far
  removed: { sku: string; days: number | null }[]; // removed in the window, with days listed before removal
}

export interface CategoryRank {
  name: string;
  sold: number;
  stocked: number;               // sold + in stock + removed
  profit: number;                // real total profit, never blended
  actualPerSale: number | null;  // real average profit per sale
  trust: number;                 // 0–1; under 0.5 is an "early read"
  sellThrough: number;           // blended, 0–1
  perSale: number;               // blended profit per sale, £
  perItem: number;               // sell-through × profit per sale, £
  days: number | null;           // own median days to sell, or longest seen if half haven't sold
  daysReached: boolean;          // true when at least half have sold
  blendedDays: number | null;
  aged: number | null;           // unsold items past twice the business median (null until it exists)
  early: boolean;
  abc: "A" | "B" | "C";
  signal: "More" | "Less" | "Watch";
}

export interface Ranking {
  categories: CategoryRank[];
  // trustK: the k in trust = n / (n + k) for sell-through.
  business: { sellThrough: number; perSale: number; perItem: number; medianDays: number | null; medianReached: boolean; trustK: number };
}

type Life = { t: number | null; sold: boolean };

// Median time to sell, counting unsold items as censored. When half never
// sold, returns the longest time seen and reached = false.
export function kmMedian(lives: Life[]): { median: number | null; reached: boolean } {
  const L = lives.filter((x): x is { t: number; sold: boolean } => x.t !== null && Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t || Number(b.sold) - Number(a.sold));
  if (!L.length) return { median: null, reached: false };
  let survive = 1, atRisk = L.length, i = 0;
  while (i < L.length) {
    const t = L[i].t;
    let died = 0, censored = 0;
    while (i < L.length && L[i].t === t) { if (L[i].sold) died++; else censored++; i++; }
    if (died) {
      survive *= 1 - died / atRisk;
      if (survive <= 0.5) return { median: t, reached: true };
    }
    atRisk -= died + censored;
  }
  return { median: L[L.length - 1].t, reached: false };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function percentile(sorted: number[], p: number) {
  const x = (sorted.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
}

export function rankCategoriesFairly({ sales, stock, removed }: RankingInput): Ranking {
  // open = unsold or removed (censored); inStock = just the unsold ones' days.
  type Group = { sold: { profit: number; capped: number; life: Life }[]; open: Life[]; inStock: (number | null)[] };
  const groups = new Map<string, Group>();
  const group = (name: string) => {
    if (!groups.has(name)) groups.set(name, { sold: [], open: [], inStock: [] });
    return groups.get(name)!;
  };

  // Bought stock only: custom pieces would skew which stock is worth sourcing.
  const bought = (sku: string) => hasSku(sku) && !isCustomSku(sku);
  const soldSales = sales.filter((s) => bought(s.sku));
  const profits = soldSales.map((s) => Number(s.profit) || 0).sort((a, b) => a - b);
  const [p5, p95] = profits.length ? [percentile(profits, 0.05), percentile(profits, 0.95)] : [0, 0];

  soldSales.forEach((s) => {
    const profit = Number(s.profit) || 0;
    const days = Number(s.tts);
    const t = s.tts !== "" && s.tts !== "N/A" && Number.isFinite(days) ? days : null;
    group(categoryOf(s.sku, s.note)).sold.push({ profit, capped: Math.min(p95, Math.max(p5, profit)), life: { t, sold: true } });
  });
  stock.filter((i) => bought(i.sku)).forEach((i) => {
    const g = group(categoryOf(i.sku));
    g.open.push({ t: i.days, sold: false });
    g.inStock.push(i.days);
  });
  removed.filter((i) => bought(i.sku)).forEach((i) => group(categoryOf(i.sku)).open.push({ t: i.days, sold: false }));

  const cats = [...groups.entries()].map(([name, g]) => ({ name, g, sold: g.sold.length, stocked: g.sold.length + g.open.length }));
  const N = cats.reduce((a, c) => a + c.stocked, 0);
  const SOLD = cats.reduce((a, c) => a + c.sold, 0);
  const p = N ? SOLD / N : 0;

  // Sell-through: how much categories really differ vs. how noisy each is.
  const rate = (c: (typeof cats)[number]) => (c.stocked ? c.sold / c.stocked : 0);
  const epvST = N > cats.length ? cats.reduce((a, c) => a + c.sold * (1 - rate(c)), 0) / (N - cats.length) : 0;
  const vhmDen = N - cats.reduce((a, c) => a + c.stocked ** 2, 0) / (N || 1);
  const vhmST = vhmDen > 0 ? (cats.reduce((a, c) => a + c.stocked * (rate(c) - p) ** 2, 0) - (cats.length - 1) * epvST) / vhmDen : 0;
  const kST = vhmST > 0 ? epvST / vhmST : Infinity;

  // Profit per sale, on capped profits.
  const withSales = cats.filter((c) => c.sold > 0);
  const allCapped = withSales.flatMap((c) => c.g.sold.map((s) => s.capped));
  const mu = allCapped.length ? mean(allCapped) : 0;
  const within = withSales.reduce((a, c) => {
    const m = mean(c.g.sold.map((s) => s.capped));
    return a + c.g.sold.reduce((x, s) => x + (s.capped - m) ** 2, 0);
  }, 0);
  const dfW = withSales.reduce((a, c) => a + c.sold - 1, 0);
  const epvP = dfW > 0 ? within / dfW : 0;
  const pDen = SOLD - withSales.reduce((a, c) => a + c.sold ** 2, 0) / (SOLD || 1);
  const vhmP = pDen > 0 ? (withSales.reduce((a, c) => a + c.sold * (mean(c.g.sold.map((s) => s.capped)) - mu) ** 2, 0) - (withSales.length - 1) * epvP) / pDen : 0;
  const kP = vhmP > 0 ? epvP / vhmP : Infinity;

  const lives = (g: Group) => [...g.sold.map((s) => s.life), ...g.open];
  const biz = kmMedian(cats.flatMap((c) => lives(c.g)));

  const ranked = cats.map((c) => {
    const trust = c.stocked / (c.stocked + kST);
    const sellThrough = trust * rate(c) + (1 - trust) * p;
    const zp = c.sold / (c.sold + kP);
    const ownPerSale = c.sold ? mean(c.g.sold.map((s) => s.capped)) : mu;
    const perSale = zp * ownPerSale + (1 - zp) * mu;
    const km = kmMedian(lives(c.g));
    const blendedDays = km.median === null ? biz.median : biz.median === null ? km.median : trust * km.median + (1 - trust) * biz.median;
    const profit = c.g.sold.reduce((a, s) => a + s.profit, 0);
    return {
      name: c.name, sold: c.sold, stocked: c.stocked, profit,
      actualPerSale: c.sold ? profit / c.sold : null,
      trust, sellThrough, perSale, perItem: sellThrough * perSale,
      days: km.median, daysReached: km.reached, blendedDays,
      aged: biz.reached ? c.g.inStock.filter((d) => d !== null && d > 2 * biz.median!).length : null,
      early: trust < 0.5,
      abc: "C" as CategoryRank["abc"], signal: "Watch" as CategoryRank["signal"],
    };
  });

  const bizPerItem = p * mu;
  const byProfit = [...ranked].sort((a, b) => b.profit - a.profit);
  const total = byProfit.reduce((a, c) => a + Math.max(0, c.profit), 0);
  let cum = 0;
  for (const c of byProfit) {
    const before = total ? cum / total : 1;
    cum += Math.max(0, c.profit);
    c.abc = before < 0.8 ? "A" : before < 0.95 ? "B" : "C";
    c.signal = c.early ? "Watch" : c.perItem >= bizPerItem ? "More" : "Less";
  }

  return {
    categories: ranked,
    business: { sellThrough: p, perSale: mu, perItem: bizPerItem, medianDays: biz.median, medianReached: biz.reached, trustK: kST },
  };
}

export type RankKey = "perItem" | "sellThrough" | "perSale" | "days";

// Best first; "Other" always last. For days, categories where half have sold
// come first (fastest first), then the rest.
export function sortCategories(cats: CategoryRank[], key: RankKey): CategoryRank[] {
  const real = cats.filter((c) => c.name !== "Other");
  const sorted = key === "days"
    ? [...real].sort((a, b) => a.daysReached === b.daysReached
      ? (a.blendedDays ?? Infinity) - (b.blendedDays ?? Infinity)
      : (a.daysReached ? -1 : 1))
    : [...real].sort((a, b) => b[key] - a[key]);
  return [...sorted, ...cats.filter((c) => c.name === "Other")];
}

// A card's winner: never "Other", and never a category with no sales yet.
export function bestCategory(cats: CategoryRank[], key: RankKey): CategoryRank | null {
  return sortCategories(cats, key).find((c) => c.name !== "Other" && c.sold > 0 && (key !== "days" || c.blendedDays !== null)) ?? null;
}
