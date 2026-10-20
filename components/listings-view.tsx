"use client";

import { useState } from "react";
import { Loader2, Check, X, ChevronDown } from "lucide-react";
import { GenerateSkuDialog } from "@/components/generate-sku-dialog";
import { ListingPhotoPicker, PhotoSlot } from "@/components/listing-photo-picker";
import { ListingResultPopup, ListingResult } from "@/components/listing-result-popup";
import { SKU_CATEGORIES } from "@/lib/sku-categories";
import { LISTING_MODELS, ListingModelId } from "@/lib/listing-models";

export function ListingsView({ onClose }: { onClose: () => void }) {
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [sku, setSku] = useState<string | null>(null);
  const [manualSku, setManualSku] = useState("");

  const [photos, setPhotos] = useState<PhotoSlot[]>([]);

  const [category, setCategory] = useState(SKU_CATEGORIES[0].name);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("Very good");
  const [measurements, setMeasurements] = useState("");
  const [notes, setNotes] = useState("");

  const [model, setModel] = useState<ListingModelId>(LISTING_MODELS[0].id);
  const [isPlatformsOpen, setIsPlatformsOpen] = useState(false);
  const [saveVinted, setSaveVinted] = useState(true);
  const [saveDepop, setSaveDepop] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ListingResult | null>(null);

  const canGenerate = photos.length > 0 && !isGenerating;

  const generateListing = async () => {
    if (!saveVinted && !saveDepop) {
      setResult({ kind: "failed", reason: "Tick Vinted, Depop or both first.", sku: null });
      return;
    }
    setIsGenerating(true);
    try {
      const formData = new FormData();
      if (sku) formData.set("sku", sku);
      formData.set("category", category);
      formData.set("brand", brand);
      formData.set("size", size);
      formData.set("condition", condition);
      formData.set("measurements", measurements);
      formData.set("notes", notes);
      formData.set("model", model);
      if (saveVinted) formData.append("platforms", "vinted");
      if (saveDepop) formData.append("platforms", "depop");
      photos.forEach((p) => formData.append("photos", p.file));

      const res = await fetch("/api/listings/generate", { method: "POST", body: formData });
      // A Vercel timeout or crash answers with a plain-text page, not JSON —
      // say what actually happened instead of "couldn't reach the server".
      const data = await res.json().catch(() => null);
      if (!data) {
        const reason = res.status === 504
          ? "The server ran out of time before the listing was saved."
          : `The server failed (status ${res.status}).`;
        setResult({ kind: "failed", reason: `${reason} If a SKU was made, check the sheet for it and type it into the SKU box before trying again.`, sku: null });
        return;
      }

      // The server only spends a SKU once the AI content has already
      // succeeded — if one comes back here, it's real and already in the
      // sheet, whether or not the rest of this request went on to succeed.
      // Keeping it means a retry reuses it rather than spending another.
      if (data.sku && data.newlyGeneratedSku) setSku(data.sku);

      if (!res.ok) {
        setResult({ kind: "failed", reason: data.error || "Failed to generate the listing.", sku: data.sku ?? null });
      } else {
        setResult({ kind: "saved", sku: data.sku, vintedLink: data.vintedLink, depopLink: data.depopLink });
      }
    } catch {
      setResult({ kind: "failed", reason: "Couldn't reach the server.", sku: null });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between mt-2">
        <h3 className="text-sm font-semibold tracking-wide">Listings</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {sku ? (
          <span className="flex-1 text-[10px] font-mono text-white/40 tracking-wider">SKU: {sku}</span>
        ) : (
          <input
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            onBlur={() => { if (manualSku.trim()) setSku(manualSku.trim()); }}
            placeholder="existing SKU"
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[10px] font-mono text-white/70 placeholder:text-white/30 outline-none focus:border-white/30 tracking-wider transition-colors"
          />
        )}
        <button
          onClick={() => setIsSkuDialogOpen(true)}
          className="border border-white/10 text-white/60 text-[9.5px] font-bold uppercase tracking-widest px-3.5 py-2 rounded-lg hover:text-white hover:border-white/30 transition-colors shrink-0"
        >
          Generate SKU
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <ListingPhotoPicker photos={photos} onChange={setPhotos} />

        <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none appearance-none"
          >
            {SKU_CATEGORIES.map((c) => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Brand</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Carhartt WIP"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Size</label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g. Medium"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Condition</label>
          <input
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-white/50 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Measurements</label>
          <textarea
            value={measurements}
            onChange={(e) => setMeasurements(e.target.value)}
            placeholder="Pit to pit: 20 inches..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/50 transition-colors min-h-[64px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Notes for the AI</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything not visible in the photos — a stain, how it fits, a repair..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/50 transition-colors min-h-[64px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">AI model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ListingModelId)}
            className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none appearance-none"
          >
            {LISTING_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col bg-white/5 border border-white/10 rounded-xl">
          <button
            onClick={() => setIsPlatformsOpen(!isPlatformsOpen)}
            aria-expanded={isPlatformsOpen}
            className="flex items-center justify-between px-4 py-3.5"
          >
            <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Save for</span>
            <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isPlatformsOpen ? "rotate-180" : ""}`} />
          </button>
          {isPlatformsOpen && (
            <div className="flex items-center gap-10 px-4 pt-1 pb-[18px]">
              <button
                onClick={() => setSaveVinted(!saveVinted)}
                role="checkbox"
                aria-checked={saveVinted}
                className="flex items-center gap-3"
              >
                <span className="text-sm font-medium">Vinted</span>
                <span className={`w-6 h-6 rounded-[7px] flex items-center justify-center transition-colors ${saveVinted ? "bg-white" : "border-[1.5px] border-white/25"}`}>
                  {saveVinted && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />}
                </span>
              </button>
              <button
                onClick={() => setSaveDepop(!saveDepop)}
                role="checkbox"
                aria-checked={saveDepop}
                className="flex items-center gap-3"
              >
                <span className="text-sm font-medium">Depop</span>
                <span className={`w-6 h-6 rounded-[7px] flex items-center justify-center transition-colors ${saveDepop ? "bg-white" : "border-[1.5px] border-white/25"}`}>
                  {saveDepop && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />}
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={generateListing}
          disabled={!canGenerate}
          className="w-full py-3.5 bg-white text-black font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isGenerating ? "Generating" : "Generate Listing"}
        </button>
      </div>

      <GenerateSkuDialog
        isOpen={isSkuDialogOpen}
        onClose={() => setIsSkuDialogOpen(false)}
        onGenerated={(newSku) => setSku(newSku)}
      />

      <ListingResultPopup result={result} onClose={() => setResult(null)} />
    </div>
  );
}
