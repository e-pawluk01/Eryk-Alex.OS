import { SKU_CATEGORIES } from "./sku-categories";

// One fixed colour per category, used everywhere the category appears.
export const CATEGORY_COLORS: Record<string, string> = {
  "Outerwear": "#3987e5", "Jumpers & Sweaters": "#d95926", "Jeans": "#199e70", "Tops & t-shirts": "#c98500",
  "Dresses": "#d55181", "Shoes": "#008300", "Bags": "#9085e9", "Accessories": "#e66767",
  "Trousers & leggings": "#2aa7b8", "Skirts": "#8bb832", "Activewear": "#b86bd1", "Suits & Blazers": "#a0826d",
  "Blouses": "#5c7cfa", "Shorts & Cropped Trousers": "#e0a33a", "Lingerie & nightwear": "#e07aa8",
  "Other": "#555553",
};
export const categoryColor = (name: string) => CATEGORY_COLORS[name] ?? CATEGORY_COLORS.Other;

const NAME_BY_CODE = new Map(SKU_CATEGORIES.map((c) => [c.code, c.name]));

// Old SKUs (before Aug 2026's new system) are one letter + digits, e.g. B002.
// O and J were shared between categories, so those go through the exact
// per-item list below instead.
const OLD_LETTER: Record<string, string> = {
  D: "Dresses", S: "Skirts", T: "Tops & t-shirts", R: "Shorts & Cropped Trousers",
  L: "Lingerie & nightwear", C: "Activewear", H: "Shoes", B: "Bags", A: "Accessories",
};

// Every old O / J item, confirmed one by one (Sep 2026). O014 couldn't be
// identified, so it stays "Other".
const OLD_SKU_CATEGORY: Record<string, string> = {
  O003: "Tops & t-shirts", O005: "Tops & t-shirts", O006: "Tops & t-shirts", O007: "Tops & t-shirts", O008: "Tops & t-shirts",
  O010: "Jumpers & Sweaters", O011: "Jumpers & Sweaters", O012: "Suits & Blazers",
  O002: "Outerwear", O009: "Outerwear", O004: "Accessories",
  J001: "Jeans", J006: "Jeans", J007: "Jeans", J008: "Jeans", J010: "Jeans", J013: "Jeans", J015: "Jeans", J016: "Jeans",
  J003: "Trousers & leggings", J009: "Trousers & leggings", J012: "Trousers & leggings",
  J002: "Shorts & Cropped Trousers", J004: "Shorts & Cropped Trousers", J005: "Shorts & Cropped Trousers", J011: "Shorts & Cropped Trousers",
};

// "OU-0142" / "OU0142" -> "Outerwear"; "B002" -> "Bags". Anything else counts
// as "Other". `note` is the sheet's Notes column, only needed for the two
// August sales entered with "NULL" as their SKU (jean shorts and a top).
export function categoryOf(sku: string, note = ""): string {
  const code = (sku ?? "").trim().toUpperCase();
  if (OLD_SKU_CATEGORY[code]) return OLD_SKU_CATEGORY[code];
  if (code === "NULL") return /short/i.test(note) ? "Shorts & Cropped Trousers" : "Tops & t-shirts";
  const letters = code.match(/^[A-Z]+/)?.[0] ?? "";
  if (letters.length === 2) return NAME_BY_CODE.get(letters) ?? "Other";
  if (letters.length === 1) return OLD_LETTER[letters] ?? "Other";
  return "Other";
}

export interface CategorySale {
  sku: string;
  buy: number;
  sold: number;
  profit: number;
  tts: string | number;
  note?: string;
}

export interface CategoryStats {
  name: string;
  sold: number;
  stocked: number;     // sold in the window + still in stock now
  revenue: number;
  profit: number;
  avgProfit: number;
  margin: number;      // % of sale price kept as profit
  sellThrough: number; // % of stocked that sold
  avgDays: number | null;
}

export function categoryStats(sales: CategorySale[], stockSkus: string[]): CategoryStats[] {
  const byName = new Map<string, { sold: number; revenue: number; profit: number; days: number[]; stock: number }>();
  const entry = (name: string) => {
    if (!byName.has(name)) byName.set(name, { sold: 0, revenue: 0, profit: 0, days: [], stock: 0 });
    return byName.get(name)!;
  };
  sales.forEach((s) => {
    const e = entry(categoryOf(s.sku, s.note));
    e.sold++;
    e.revenue += Number(s.sold) || 0;
    e.profit += Number(s.profit) || 0;
    const days = Number(s.tts);
    if (s.tts !== "" && s.tts !== "N/A" && Number.isFinite(days)) e.days.push(days);
  });
  stockSkus.forEach((sku) => { entry(categoryOf(sku)).stock++; });

  return [...byName.entries()].map(([name, e]) => ({
    name,
    sold: e.sold,
    stocked: e.sold + e.stock,
    revenue: e.revenue,
    profit: e.profit,
    avgProfit: e.sold > 0 ? e.profit / e.sold : 0,
    margin: e.revenue > 0 ? (e.profit / e.revenue) * 100 : 0,
    sellThrough: e.sold + e.stock > 0 ? (e.sold / (e.sold + e.stock)) * 100 : 0,
    avgDays: e.days.length > 0 ? e.days.reduce((a, d) => a + d, 0) / e.days.length : null,
  }));
}

export type CategoryMeasure = "margin" | "sellThrough" | "avgDays" | "profit";

// Best first. Only categories with at least one sale can win.
export function rankCategories(stats: CategoryStats[], by: CategoryMeasure): CategoryStats[] {
  const withSales = stats.filter((c) => c.sold > 0 && (by !== "avgDays" || c.avgDays !== null));
  const rest = stats.filter((c) => !withSales.includes(c));
  const sorted = [...withSales].sort((a, b) => (by === "avgDays" ? (a.avgDays! - b.avgDays!) : b[by] - a[by]));
  return [...sorted, ...rest];
}
