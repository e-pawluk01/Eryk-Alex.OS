// Fixed listing templates. The wording, symbols, and line breaks here are
// locked to Eryk's exact spec — only the interpolated values change per item.
import { DepopContent, VintedContent } from "./listing-ai";
import { getMeasurementLabels } from "./measurement-labels";

interface DepopTemplateInput extends DepopContent {
  brand: string;
  size: string;
  condition: string;
  sku: string;
  category: string;
}

export function buildDepopText(input: DepopTemplateInput): string {
  const tagLine = input.tags.map((t) => `#${t}`).join(" ");
  const labels = getMeasurementLabels(input.category);

  const measurementsBlock = labels
    ? `\n｡°✩ Flat Measurements ✩°｡⋆\n\n${labels[0]}: ~${input.measurement1Value}"\n${labels[1]}: ~${input.measurement2Value}"\n`
    : "";

  return `✩°｡⋆ ${input.title} ✩°｡⋆

${input.description}

｡°✩ Item Details ✩°｡⋆

Brand: ${input.brand}
Size: ${input.size}
Condition: ${input.condition}
SKU: ${input.sku}
${measurementsBlock}
⋆｡°✩ Please Read Carefully ✩°｡⋆

Any minor damages, stains, or signs of wear are clearly shown in photos. Please swipe through before buying. Sale includes ONLY the ${input.itemType}. Prepared with care in a smoke-free, pet-friendly home (dog and bunny). Questions welcome!

˚₊‧꒰ა ☆ ໒꒱ ‧₊˚ Tags: ${tagLine}`;
}

interface VintedTemplateInput extends VintedContent {
  brand: string;
  size: string;
  condition: string;
  sku: string;
  category: string;
}

export function buildVintedText(input: VintedTemplateInput): string {
  const tagLine = input.tags.map((t) => `#${t}`).join(" ");
  const labels = getMeasurementLabels(input.category);
  const hasMeasurements = labels && (input.measurement1Value || input.measurement2Value);

  const measurementsBlock = hasMeasurements
    ? `\n｡°✩ Flat Measurements ✩°｡⋆\n★ ${labels[0]}: ~${input.measurement1Value}"\n★ ${labels[1]}: ~${input.measurement2Value}"\n`
    : "";

  return `${input.title}

｡°✩ Item Details ✩°｡⋆
★ Brand: ${input.brand}
★ Size: ${input.size}
★ Condition: ${input.condition}
★ SKU: ${input.sku}
${measurementsBlock}
⋆｡°✩ Please Read Carefully ✩°｡⋆
★ Condition Note: We do our best to thoroughly inspect every piece! Any minor damages, stains, rips, or signs of wear are clearly shown in the photos and reflected in the price. Please swipe through all images before buying!
★ What's included: Please note that this sale includes ONLY the ${input.itemType}. All other accessories, clothes, or props are for styling examples only.
★ We have a dog and a bunny! While we do our absolute best to ensure every item is cleaned before shipping, we can't guarantee they are 100% free of stray hairs. Please keep this in mind if you have severe allergies!
★ Shop Policies: For more information on returns, shipping, and other details, please check out the 'about' section on our profile.

˚₊‧꒰ა ☆ ໒꒱ ‧₊˚ Tags: ${tagLine}`;
}
