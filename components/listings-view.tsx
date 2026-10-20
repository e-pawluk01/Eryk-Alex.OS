"use client";

import { useState } from "react";
import { Loader2, Check, AlertTriangle, X } from "lucide-react";
import { GenerateSkuDialog } from "@/components/generate-sku-dialog";
import { ListingPhotoPicker, PhotoSlot } from "@/components/listing-photo-picker";
import { SkuGeneratedNotice } from "@/components/sku-generated-notice";
import { SKU_CATEGORIES } from "@/lib/sku-categories";

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [depopLink, setDepopLink] = useState<string | null>(null);
  const [vintedLink, setVintedLink] = useState<string | null>(null);
  const [autoSkuNotice, setAutoSkuNotice] = useState<string | null>(null);

  const canGenerate = photos.length > 0 && !isGenerating;

  const generateListing = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setDepopLink(null);
    setVintedLink(null);
    try {
      const formData = new FormData();
      if (sku) formData.set("sku", sku);
      formData.set("category", category);
      formData.set("brand", brand);
      formData.set("size", size);
      formData.set("condition", condition);
      formData.set("measurements", measurements);
      formData.set("notes", notes);
      photos.forEach((p) => formData.append("photos", p.file));

      const res = await fetch("/api/listings/generate", { method: "POST", body: formData });
      const data = await res.json();

      // The server only spends a SKU once the AI content has already
      // succeeded — if one comes back here, it's real and already in the
      // sheet, whether or not the rest of this request went on to succeed.
      if (data.sku && data.newlyGeneratedSku) {
        setSku(data.sku);
        setAutoSkuNotice(data.sku);
      }

      if (!res.ok) {
        setGenerateError(data.error || "Failed to generate the listing.");
      } else {
        setDepopLink(data.depopLink);
        setVintedLink(data.vintedLink);
      }
    } catch {
      setGenerateError("Couldn't reach the server.");
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

        <button
          onClick={generateListing}
          disabled={!canGenerate}
          className="w-full py-3.5 bg-white text-black font-bold uppercase tracking-widest text-[11px] rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isGenerating ? "Generating" : "Generate Listing"}
        </button>

        {generateError && (
          <div className="flex items-center gap-2 text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}

        {(depopLink || vintedLink) && (
          <div className="flex flex-col gap-2">
            {depopLink && (
              <div className="flex items-center justify-center gap-2 text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-xs">
                <Check className="w-4 h-4 shrink-0" />
                <a href={depopLink} target="_blank" rel="noreferrer" className="underline">
                  Depop listing saved to Drive
                </a>
              </div>
            )}
            {vintedLink && (
              <div className="flex items-center justify-center gap-2 text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-xs">
                <Check className="w-4 h-4 shrink-0" />
                <a href={vintedLink} target="_blank" rel="noreferrer" className="underline">
                  Vinted listing saved to Drive
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <GenerateSkuDialog
        isOpen={isSkuDialogOpen}
        onClose={() => setIsSkuDialogOpen(false)}
        onGenerated={(newSku) => setSku(newSku)}
      />

      <SkuGeneratedNotice sku={autoSkuNotice} onClose={() => setAutoSkuNotice(null)} />
    </div>
  );
}
