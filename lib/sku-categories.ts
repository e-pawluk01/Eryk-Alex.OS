// Resale category -> 2-letter SKU code. Pure data, safe to import anywhere
// (client or server). Server-side SKU generation lives in lib/sku.ts.
export const SKU_CATEGORIES: { name: string; code: string }[] = [
  { name: "Outerwear", code: "OU" },
  { name: "Jumpers & Sweaters", code: "JU" },
  { name: "Suits & Blazers", code: "SB" },
  { name: "Dresses", code: "DR" },
  { name: "Skirts", code: "SK" },
  { name: "Tops & t-shirts", code: "TO" },
  { name: "Blouses", code: "BL" },
  { name: "Jeans", code: "JS" },
  { name: "Trousers & leggings", code: "TR" },
  { name: "Shorts & Cropped Trousers", code: "ST" },
  { name: "Lingerie & nightwear", code: "LN" },
  { name: "Activewear", code: "AC" },
  { name: "Shoes", code: "SH" },
  { name: "Bags", code: "BA" },
  { name: "Accessories", code: "AS" },
];

export const SKU_CODE_BY_NAME = new Map(SKU_CATEGORIES.map((c) => [c.name, c.code]));
