// Depop listing content, written by the AI from the item's photos and details.
// The AI only ever returns these discrete fields as JSON — it never writes the
// full file itself, so the fixed template wording in lib/listing-templates.ts
// can never be altered by a model response.
const DEPOP_SYSTEM_PROMPT = `You write Depop resale listings for a secondhand fashion shop. Look at the item photos and the details given, then reply with strict JSON only (no markdown, no commentary) in exactly this shape. If seller notes are given, trust them over what you can see in the photos — they exist specifically to tell you about things a photo can't show (a hidden flaw, how it actually fits, a repair, etc.), so factor them into the description when relevant:
{
  "title": string,        // short, punchy, aesthetic-led title in a vintage/Y2K resale voice. Do not start with the brand and do not include the size.
  "description": string,  // maximum 2 sentences of plain prose, no hashtags
  "tags": string[],       // exactly 5 relevant tags, lowercase, no "#"
  "pitToPit": string,     // pit-to-pit measurement in inches if mentioned in the notes, else ""
  "length": string        // length measurement in inches if mentioned in the notes, else ""
}`;

interface Photo {
  base64: string;
  mimeType: string;
}

interface DepopContentInput {
  photos: Photo[];
  category: string;
  brand: string;
  size: string;
  condition: string;
  measurementsNotes: string;
  sellerNotes: string;
}

export interface DepopContent {
  title: string;
  description: string;
  tags: string[];
  pitToPit: string;
  length: string;
}

export async function generateDepopContent(input: DepopContentInput): Promise<DepopContent> {
  const userText = [
    `Category: ${input.category}`,
    `Brand: ${input.brand}`,
    `Size: ${input.size}`,
    `Condition: ${input.condition}`,
    `Measurement notes: ${input.measurementsNotes || "(none given)"}`,
    `Seller notes (things not visible in the photos): ${input.sellerNotes || "(none given)"}`,
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: userText }];
  for (const photo of input.photos) {
    content.push({ type: "image_url", image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` } });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: DEPOP_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`The AI service didn't respond (status ${res.status}).`);
  }

  const data = await res.json();
  const raw: string | undefined = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("The AI didn't return anything usable.");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("The AI's response wasn't in the expected format.");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    pitToPit: parsed.pitToPit ?? "",
    length: parsed.length ?? "",
  };
}
