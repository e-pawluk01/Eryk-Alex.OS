import { NextRequest, NextResponse } from "next/server";
import { generateDepopContent, generateVintedContent } from "@/lib/listing-ai";
import { buildDepopText, buildVintedText } from "@/lib/listing-templates";
import { uploadListingTextFiles } from "@/lib/google-drive";
import { generateSku } from "@/lib/sku";
import { isListingModelId, LISTING_MODELS } from "@/lib/listing-models";

// Photos + an AI vision call + two Drive round-trips routinely take longer
// than the platform's default function timeout — give it real headroom.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Tracked outside the try block so a failure after a SKU's been minted
  // can still report it back — see the catch block below.
  let sku: string | null = null;
  let newlyGeneratedSku = false;

  try {
    const formData = await req.formData();
    const providedSku = String(formData.get("sku") || "") || null;
    const category = String(formData.get("category") || "");
    const brand = String(formData.get("brand") || "");
    const size = String(formData.get("size") || "");
    const condition = String(formData.get("condition") || "");
    const measurements = String(formData.get("measurements") || "");
    const notes = String(formData.get("notes") || "");
    const model = String(formData.get("model") || "");
    if (!isListingModelId(model)) {
      return NextResponse.json({ error: "Pick an AI model first." }, { status: 400 });
    }
    const platforms = formData.getAll("platforms").map(String);
    const wantDepop = platforms.includes("depop");
    const wantVinted = platforms.includes("vinted");
    if (!wantDepop && !wantVinted) {
      return NextResponse.json({ error: "Tick Vinted, Depop or both first." }, { status: 400 });
    }

    const photoFiles = formData.getAll("photos").filter((p): p is File => p instanceof File);
    if (photoFiles.length === 0) {
      return NextResponse.json({ error: "Add at least one photo before generating a listing." }, { status: 400 });
    }

    const photos = await Promise.all(
      photoFiles.map(async (file) => ({
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mimeType: file.type || "image/jpeg",
      }))
    );

    const itemInput = {
      photos,
      category,
      brand,
      size,
      measurementsNotes: measurements,
      sellerNotes: notes,
      model,
    };

    // 1. Write the ticked platforms' content first — neither needs a SKU at
    // all, so a failure here costs nothing. Run them together since they're
    // independent AI calls.
    const [depop, vinted] = await Promise.all([
      wantDepop ? generateDepopContent(itemInput) : null,
      wantVinted ? generateVintedContent(itemInput) : null,
    ]);

    // 2. Only now spend a SKU, and only if the caller didn't already bring
    // one in (from the standalone popup, or typed in manually).
    if (providedSku) {
      sku = providedSku;
    } else {
      const skuResult = await generateSku(category);
      if ("error" in skuResult && skuResult.error) {
        return NextResponse.json({ error: skuResult.error }, { status: 400 });
      }
      sku = skuResult.sku!;
      newlyGeneratedSku = true;
    }

    // 3. File them — from here on the SKU is spent regardless of outcome,
    // since Drive needs it to name the folder.
    const files: { filename: string; content: string }[] = [];
    if (depop) files.push({ filename: "depop.txt", content: buildDepopText({ ...depop.content, brand, size, condition, sku, category }) });
    if (vinted) files.push({ filename: "vinted.txt", content: buildVintedText({ ...vinted.content, brand, size, condition, sku, category }) });
    files.push({ filename: "cost.txt", content: buildCostText(sku, model, { vinted: vinted?.cost, depop: depop?.cost }) });

    const links = await uploadListingTextFiles(sku, files);
    const depopLink = depop ? links[0] : null;
    const vintedLink = vinted ? links[depop ? 1 : 0] : null;

    return NextResponse.json({ depopLink, vintedLink, sku, newlyGeneratedSku });
  } catch (err) {
    console.error("Listing generation failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong generating the listing.";
    return NextResponse.json({ error: message, sku, newlyGeneratedSku }, { status: 500 });
  }
}

const formatCost = (cost: number | null) => (cost === null ? "unknown" : `$${cost.toFixed(4)}`);

// What this generation cost, from OpenRouter's own figure for each AI call.
// Only platforms that were ticked get a line.
function buildCostText(sku: string, model: string, costs: { vinted?: number | null; depop?: number | null }): string {
  const generated = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
  const modelLabel = LISTING_MODELS.find((m) => m.id === model)?.label ?? model;
  const platformCosts = (["vinted", "depop"] as const).filter((p) => costs[p] !== undefined);

  const lines = [`SKU: ${sku}`, `Generated: ${generated}`, `Model: ${modelLabel}`, "Result: Success", ""];
  for (const p of platformCosts) lines.push(`${p === "vinted" ? "Vinted" : "Depop"}: ${formatCost(costs[p] ?? null)}`);

  const known = platformCosts.map((p) => costs[p]);
  const total = known.every((c): c is number => typeof c === "number") ? known.reduce((a, b) => a + b, 0) : null;
  lines.push(`Total: ${formatCost(total)}`);
  return lines.join("\n");
}
