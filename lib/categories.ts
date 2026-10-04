import { SKU_CATEGORIES } from "./sku-categories";

// One fixed colour per category, used everywhere the category appears.
export const CATEGORY_COLORS: Record<string, string> = {
  "Outerwear": "#3987e5", "Jumpers & Sweaters": "#d95926", "Jeans": "#199e70", "Tops & t-shirts": "#c98500",
  "Dresses": "#d55181", "Shoes": "#008300", "Bags": "#9085e9", "Accessories": "#e66767",
  "Trousers": "#2aa7b8", "Skirts": "#8bb832", "Activewear": "#b86bd1", "Suits & Blazers": "#a0826d",
  "Blouses": "#5c7cfa", "Shorts": "#e0a33a", "Lingerie & nightwear": "#e07aa8",
  "Other": "#555553",
};
export const categoryColor = (name: string) => CATEGORY_COLORS[name] ?? CATEGORY_COLORS.Other;

const NAME_BY_CODE = new Map(SKU_CATEGORIES.map((c) => [c.code, c.name]));

// Old SKUs (before Aug 2026's new system) are one letter + digits, e.g. B002.
// O and J were shared between categories, so those go through the exact
// per-item list below instead.
const OLD_LETTER: Record<string, string> = {
  D: "Dresses", S: "Skirts", T: "Tops & t-shirts", R: "Shorts",
  L: "Lingerie & nightwear", C: "Activewear", H: "Shoes", B: "Bags", A: "Accessories",
};

// Old SKUs whose letter doesn't give the category: every old O / J item,
// confirmed one by one (Sep 2026), plus the one cropped-trousers R item.
// Denim capris count as Jeans; other capris and cropped trousers as Trousers.
// O014 couldn't be identified, so it stays "Other".
const OLD_SKU_CATEGORY: Record<string, string> = {
  O003: "Tops & t-shirts", O005: "Tops & t-shirts", O006: "Tops & t-shirts", O007: "Tops & t-shirts", O008: "Tops & t-shirts",
  O010: "Jumpers & Sweaters", O011: "Jumpers & Sweaters", O012: "Suits & Blazers",
  O002: "Outerwear", O009: "Outerwear", O004: "Accessories",
  J001: "Jeans", J004: "Jeans", J005: "Jeans", J006: "Jeans", J007: "Jeans", J008: "Jeans", J010: "Jeans",
  J011: "Jeans", J013: "Jeans", J015: "Jeans", J016: "Jeans",
  J002: "Trousers", J003: "Trousers", J009: "Trousers", J012: "Trousers", R012: "Trousers",
};

// Custom pieces (made by us, from the Lab) use the same codes behind a CM-
// prefix: CM-BA001 is our first custom bag. Same categories, own numbering.
const CUSTOM_PREFIX = /^CM-/;
export const isCustomSku = (sku: string) => CUSTOM_PREFIX.test((sku ?? "").trim().toUpperCase());

// "OU-0142" / "OU0142" -> "Outerwear"; "B002" -> "Bags"; "CM-BA001" -> "Bags".
// Anything else counts as "Other". `note` is the sheet's Notes column, only
// needed for the two August sales entered with "NULL" as their SKU (jean
// shorts and a top).
export function categoryOf(sku: string, note = ""): string {
  const code = (sku ?? "").trim().toUpperCase().replace(CUSTOM_PREFIX, "");
  if (OLD_SKU_CATEGORY[code]) return OLD_SKU_CATEGORY[code];
  if (code === "NULL") return /short/i.test(note) ? "Shorts" : "Tops & t-shirts";
  const letters = code.match(/^[A-Z]+/)?.[0] ?? "";
  if (letters.length === 2) return NAME_BY_CODE.get(letters) ?? "Other";
  if (letters.length === 1) return OLD_LETTER[letters] ?? "Other";
  return "Other";
}

// Rows with no SKU (blank, or "N/A" as the sales table shows it) can't be
// placed, so they're left out of Categories altogether.
export const hasSku = (sku: string) => !["", "N/A"].includes((sku ?? "").trim().toUpperCase());

export interface CategorySale {
  sku: string;
  buy: number;
  sold: number;
  profit: number;
  tts: string | number;
  note?: string;
}
