import { NextRequest, NextResponse } from "next/server";
import { generateDepopContent } from "@/lib/listing-ai";
import { buildDepopText } from "@/lib/listing-templates";
import { uploadListingTextFile } from "@/lib/google-drive";

// Photos + an AI vision call + two Drive round-trips routinely take longer
// than the platform's default function timeout — give it real headroom.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sku = String(formData.get("sku") || "");
    const category = String(formData.get("category") || "");
    const brand = String(formData.get("brand") || "");
    const size = String(formData.get("size") || "");
    const condition = String(formData.get("condition") || "");
    const measurements = String(formData.get("measurements") || "");
    const notes = String(formData.get("notes") || "");

    if (!sku) {
      return NextResponse.json({ error: "Generate a SKU before generating a listing." }, { status: 400 });
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

    const content = await generateDepopContent({
      photos,
      category,
      brand,
      size,
      condition,
      measurementsNotes: measurements,
      sellerNotes: notes,
    });

    const depopText = buildDepopText({ ...content, brand, size, condition, sku, category });
    const fileLink = await uploadListingTextFile(sku, "depop.txt", depopText);

    return NextResponse.json({ fileLink });
  } catch (err) {
    console.error("Listing generation failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong generating the listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
