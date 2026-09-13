// Fixed listing templates. The wording, symbols, and line breaks here are
// locked to Eryk's exact spec — only the interpolated values change per item.
import { DepopContent } from "./listing-ai";

interface DepopTemplateInput extends DepopContent {
  brand: string;
  size: string;
  condition: string;
  sku: string;
  category: string;
}

export function buildDepopText(input: DepopTemplateInput): string {
  const tagLine = input.tags.map((t) => `#${t}`).join(" ");

  return `✩°｡⋆ ${input.title} ✩°｡⋆

${input.description}

｡°✩ Item Details ✩°｡⋆

Brand: ${input.brand}
Size: ${input.size}
Condition: ${input.condition}
SKU: ${input.sku}

｡°✩ Flat Measurements ✩°｡⋆

Pit to pit: ~${input.pitToPit}"
Length: ~${input.length}"

⋆｡°✩ Please Read Carefully ✩°｡⋆

Any minor damages, stains, or signs of wear are clearly shown in photos. Please swipe through before buying. Sale includes ONLY the ${input.category}. Prepared with care in a smoke-free, pet-friendly home (dog and bunny). Questions welcome!

˚₊‧꒰ა ☆ ໒꒱ ‧₊˚ Tags: ${tagLine}`;
}
