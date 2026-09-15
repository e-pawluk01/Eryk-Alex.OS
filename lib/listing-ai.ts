import { getMeasurementLabels } from "./measurement-labels";

// Depop and Vinted listing content, written by the AI from the item's photos
// and details. The AI only ever returns discrete fields as JSON — it never
// writes the full file itself, so the fixed template wording in
// lib/listing-templates.ts can never be altered by a model response.

const NICHE_VOCAB = "Y2K, McBling, coquette, whimsigoth, mall goth, indie sleaze, Barbiecore, grunge, cybery2k, western core, alt, preppy";

const VOICE_EXAMPLES = `Reference examples of the shop's actual voice — match this level of specificity, don't write generic marketing copy:

1. "Acid Wash Mid Rise Skinny Jeans" — "Acid wash low rise skinny leg jeans with contrast stitching and pocket detailing. Classic 00s Y2K denim with an alt, worn-in feel." Tags: y2k, acidwash, skinnyjeans, next, vintage

2. "Grey Marl Neon Pink Logo Tee" — "Dark grey marl fitted t-shirt with a neon pink graphic logo. Indie sleaze, trashy 00s piece with a bold Y2K feel." Tags: indiesleaze, y2k, superdry, vintagetee, 00s

3. "Hot Pink Flamingo Polo Top" — "Hot pink polo shirt with flamingo embroidery and cap sleeves. Preppy Barbiecore piece with a fitted, fun Y2K feel." Tags: barbiecore, y2k, polo, preppy, vintage`;

interface Photo {
  base64: string;
  mimeType: string;
}

interface ItemInput {
  photos: Photo[];
  category: string;
  brand: string;
  size: string;
  measurementsNotes: string;
  sellerNotes: string;
}

function buildUserText(input: ItemInput): string {
  return [
    `Category: ${input.category}`,
    `Brand: ${input.brand}`,
    `Size: ${input.size}`,
    `Measurement notes: ${input.measurementsNotes || "(none given)"}`,
    `Seller notes (things not visible in the photos): ${input.sellerNotes || "(none given)"}`,
  ].join("\n");
}

function buildImageContent(photos: Photo[]) {
  return photos.map((photo) => ({
    type: "image_url",
    image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` },
  }));
}

async function callOpenRouter(systemPrompt: string, userText: string, photos: Photo[]): Promise<Record<string, unknown>> {
  const content: unknown[] = [{ type: "text", text: userText }, ...buildImageContent(photos)];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) throw new Error(`The AI service didn't respond (status ${res.status}).`);

  const data = await res.json();
  const raw: string | undefined = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("The AI didn't return anything usable.");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("The AI's response wasn't in the expected format.");
  return JSON.parse(jsonMatch[0]);
}

export interface DepopContent {
  title: string;
  description: string;
  tags: string[];
  itemType: string;
  measurement1Value: string;
  measurement2Value: string;
}

export async function generateDepopContent(input: ItemInput): Promise<DepopContent> {
  const labels = getMeasurementLabels(input.category);
  const measurementInstruction = labels
    ? `"measurement1Value": string, // the "${labels[0]}" measurement in inches, ONLY if explicitly given in the measurement notes, else ""\n  "measurement2Value": string, // the "${labels[1]}" measurement in inches, ONLY if explicitly given in the measurement notes, else ""`
    : `"measurement1Value": "", "measurement2Value": "" // this category has no flat-measurement section — always leave these blank`;

  const systemPrompt = `You write Depop resale listings for a secondhand fashion shop specialising in Y2K and niche aesthetics. Look at the item photos and the details given, then reply with strict JSON only (no markdown, no commentary) in exactly this shape:
{
  "title": string,        // short, punchy, aesthetic-led title. Lean on specific subculture/aesthetic vocabulary (${NICHE_VOCAB}) rather than generic phrases like "giving vibes". Do not start with the brand and do not include the size.
  "description": string,  // 1-2 sentences, natural keyword-rich prose, no hashtags
  "tags": string[],       // exactly 5 tags. Each tag is a single lowercase word or squashed-together compound with NO spaces (e.g. "acidwash" not "acid wash"). Include the brand as one of the 5 if given.
  "itemType": string,     // a natural singular or plural noun for this item (e.g. "jeans", "top", "dress", "jacket") for use in the sentence "Sale includes ONLY the {itemType}"
  ${measurementInstruction}
}
Never invent or estimate a measurement that wasn't actually given — leave it blank rather than guess. If seller notes are given, trust them over what you can see in the photos for anything a photo can't show (a hidden flaw, how it actually fits, a repair), and factor them into the description when relevant.

${VOICE_EXAMPLES}`;

  const parsed = await callOpenRouter(systemPrompt, buildUserText(input), input.photos);
  return {
    title: (parsed.title as string) ?? "",
    description: (parsed.description as string) ?? "",
    tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]).slice(0, 5) : [],
    itemType: (parsed.itemType as string) ?? input.category,
    measurement1Value: (parsed.measurement1Value as string) ?? "",
    measurement2Value: (parsed.measurement2Value as string) ?? "",
  };
}

export interface VintedContent {
  title: string;
  tags: string[];
  itemType: string;
}

export async function generateVintedContent(input: ItemInput): Promise<VintedContent> {
  const systemPrompt = `You write Vinted listing titles and tags for a secondhand fashion shop specialising in Y2K and niche aesthetics. Look at the item photos and the details given, then reply with strict JSON only (no markdown, no commentary) in exactly this shape:
{
  "title": string,    // ONE dense, keyword-stacked title: brand, size, fit, wash/colour, standout features, and aesthetic terms (${NICHE_VOCAB}). Aim for 90-98 characters, NEVER exceed 100. Style target: "Y2K Mudd Rhinestone Embellished Cross Flap Pocket Jeans Dark Wash Contrast Stitch Vintage" (91 characters) — real searchable density, no filler words.
  "tags": string[],   // exactly 15 tags. Each tag is a single lowercase word or squashed-together compound with NO spaces. Mix broad aesthetic tags, specific micro-trends, precise item descriptors, and the brand.
  "itemType": string  // a natural singular or plural noun for this item (e.g. "jeans", "top", "dress") for use in the sentence "Sale includes ONLY the {itemType}"
}
Never invent a detail that wasn't given.

${VOICE_EXAMPLES}`;

  const parsed = await callOpenRouter(systemPrompt, buildUserText(input), input.photos);
  const title = ((parsed.title as string) ?? "").slice(0, 100);
  return {
    title,
    tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]).slice(0, 15) : [],
    itemType: (parsed.itemType as string) ?? input.category,
  };
}
