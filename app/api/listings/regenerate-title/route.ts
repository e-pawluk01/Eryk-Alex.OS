import { NextRequest, NextResponse } from "next/server";
import { generateTitlesOnly } from "@/lib/listing-ai";

// Deliberately separate from /api/listings/generate: no SKU, no Drive, just
// fresh titles for re-listing an item that already has everything else.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const category = String(formData.get("category") || "");
    const brand = String(formData.get("brand") || "");
    const size = String(formData.get("size") || "");
    const measurements = String(formData.get("measurements") || "");
    const notes = String(formData.get("notes") || "");

    const photoFiles = formData.getAll("photos").filter((p): p is File => p instanceof File);
    if (photoFiles.length === 0) {
      return NextResponse.json({ error: "Add at least one photo before regenerating a title." }, { status: 400 });
    }

    const photos = await Promise.all(
      photoFiles.map(async (file) => ({
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mimeType: file.type || "image/jpeg",
      }))
    );

    const titles = await generateTitlesOnly({
      photos,
      category,
      brand,
      size,
      measurementsNotes: measurements,
      sellerNotes: notes,
    });

    return NextResponse.json(titles);
  } catch (err) {
    console.error("Title regeneration failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong regenerating the title.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
