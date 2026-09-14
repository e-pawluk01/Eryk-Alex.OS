import { NextRequest, NextResponse } from "next/server";
import { generateDepopContent } from "@/lib/listing-ai";
import { buildDepopText } from "@/lib/listing-templates";
import { uploadListingTextFile } from "@/lib/google-drive";
import { generateSku } from "@/lib/sku";

// Photos + an AI vision call + two Drive round-trips routinely take longer
// than the platform's default function timeout — give it real headroom.
export const maxDuration = 60;

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

    // 1. Write the content first — this doesn't need a SKU at all, so a
    // failure here costs nothing.
    const content = await generateDepopContent({
      photos,
      category,
      brand,
      size,
      condition,
      measurementsNotes: measurements,
      sellerNotes: notes,
    });

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

    // 3. File it — from here on the SKU is spent regardless of outcome,
    // since Drive needs it to name the folder.
    const depopText = buildDepopText({ ...content, brand, size, condition, sku, category });
    const fileLink = await uploadListingTextFile(sku, "depop.txt", depopText);

    return NextResponse.json({ fileLink, sku, newlyGeneratedSku });
  } catch (err) {
    console.error("Listing generation failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong generating the listing.";
    return NextResponse.json({ error: message, sku, newlyGeneratedSku }, { status: 500 });
  }
}
