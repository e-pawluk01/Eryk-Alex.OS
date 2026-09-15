// Which two flat-measurement fields belong on a Depop listing, by category.
// null means the category doesn't get a measurements section at all.
// Lingerie & nightwear / Activewear aren't clean "top" or "bottom" fits, so
// they're left out (no section) rather than guessing wrong labels.
export const DEPOP_MEASUREMENT_LABELS: Record<string, [string, string] | null> = {
  "Outerwear": ["Pit to pit", "Length"],
  "Jumpers & Sweaters": ["Pit to pit", "Length"],
  "Suits & Blazers": ["Pit to pit", "Length"],
  "Dresses": ["Pit to pit", "Length"],
  "Tops & t-shirts": ["Pit to pit", "Length"],
  "Blouses": ["Pit to pit", "Length"],
  "Skirts": ["Waist", "Length"],
  "Jeans": ["Waist", "Inseam"],
  "Trousers & leggings": ["Waist", "Inseam"],
  "Shorts & Cropped Trousers": ["Waist", "Inseam"],
  "Bags": ["Width", "Height"],
  "Lingerie & nightwear": null,
  "Activewear": null,
  "Shoes": null,
  "Accessories": null,
};

export function getMeasurementLabels(category: string): [string, string] | null {
  return DEPOP_MEASUREMENT_LABELS[category] ?? null;
}
