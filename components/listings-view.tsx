"use client";

import { useRef, useState } from "react";
import { Plus, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { GenerateSkuDialog } from "@/components/generate-sku-dialog";
import { SKU_CATEGORIES } from "@/lib/sku-categories";

const MAX_PHOTOS = 3;

interface PhotoSlot {
  id: string;
  file: File;
  previewUrl: string;
}

export function ListingsView() {
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [sku, setSku] = useState<string | null>(null);
  const [manualSku, setManualSku] = useState("");

  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Real phone photos routinely add up to more than Vercel's ~4.5MB request
  // limit once you have 2-3 of them. Shrink before they ever leave the
  // browser; fall back to the original file if a photo can't be decoded
  // client-side (e.g. some HEIC cases) rather than blocking the upload.
  const compressImage = async (file: File, maxDimension = 1280, quality = 0.7): Promise<File> => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      return file;
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const toAdd = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room);

    const newSlots: PhotoSlot[] = await Promise.all(
      toAdd.map(async (file) => {
        const compressed = await compressImage(file);
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        };
      })
    );
    setPhotos((prev) => [...prev, ...newSlots]);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

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
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Listings</h2>
        <div className="flex items-center gap-3">
          {sku ? (
            <span className="text-[10px] font-mono text-white/40 tracking-wider">SKU: {sku}</span>
          ) : (
            <input
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              onBlur={() => { if (manualSku.trim()) setSku(manualSku.trim()); }}
              placeholder="existing SKU"
              className="w-28 bg-transparent border-b border-white/10 text-[10px] font-mono text-white/50 placeholder:text-white/15 outline-none focus:border-white/30 tracking-wider py-1"
            />
          )}
          <button
            onClick={() => setIsSkuDialogOpen(true)}
            className="border border-white/10 text-white/60 text-[9.5px] font-bold uppercase tracking-widest px-3.5 py-2 rounded-lg hover:text-white hover:border-white/30 transition-colors"
          >
            Generate SKU
          </button>
        </div>
      </div>

      <div className="max-w-2xl w-full bg-[#111] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            addPhotos(e.dataTransfer.files);
          }}
          className={`flex flex-col gap-2 rounded-xl transition-colors ${isDragActive ? "outline outline-1 outline-white/30" : ""}`}
        >
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
            Photos ({photos.length}/{MAX_PHOTOS})
          </label>
          <div className="flex gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
                <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-black/85 flex items-center justify-center hover:bg-black transition-colors"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/30 hover:text-white/50 hover:border-white/25 transition-colors shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
          />
        </div>

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

      {autoSkuNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={() => setAutoSkuNotice(null)}
          />
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4 p-6 flex flex-col items-center gap-3 text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
            <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-semibold">SKU Generated</span>
            <span className="text-3xl font-mono text-white tracking-wider">{autoSkuNotice}</span>
            <span className="text-[10px] text-white/40">Added to the sheet — this is used now no matter what happens next.</span>
            <button
              onClick={() => setAutoSkuNotice(null)}
              className="w-full py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 transition-all mt-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
