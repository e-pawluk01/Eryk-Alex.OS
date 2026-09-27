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

// "OU-0142" / "OU0142" -> "Outerwear". Anything without a known 2-letter
// code at the start (older SKUs, blanks) counts as "Other".
export function categoryOf(sku: string): string {
  const letters = (sku ?? "").trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "";
  return (letters.length === 2 && NAME_BY_CODE.get(letters)) || "Other";
}

export interface CategorySale {
  sku: string;
  buy: number;
  sold: number;
  profit: number;
  tts: string | number;
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
    const e = entry(categoryOf(s.sku));
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
