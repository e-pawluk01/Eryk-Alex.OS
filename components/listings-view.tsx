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

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [fileLink, setFileLink] = useState<string | null>(null);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const toAdd = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room);
    const newSlots: PhotoSlot[] = toAdd.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
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
    setFileLink(null);
    try {
      let activeSku = sku;
      if (!activeSku) {
        const skuRes = await fetch("/api/sku/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
        const skuData = await skuRes.json();
        if (!skuRes.ok) {
          setGenerateError(skuData.error || "Failed to generate a SKU.");
          return;
        }
        activeSku = skuData.sku;
        setSku(activeSku);
      }

      const formData = new FormData();
      formData.set("sku", activeSku!);
      formData.set("category", category);
      formData.set("brand", brand);
      formData.set("size", size);
      formData.set("condition", condition);
      formData.set("measurements", measurements);
      photos.forEach((p) => formData.append("photos", p.file));

      const res = await fetch("/api/listings/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setGenerateError(data.error || "Failed to generate the listing.");
      else setFileLink(data.fileLink);
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

        {fileLink && (
          <div className="flex items-center justify-center gap-2 text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <a href={fileLink} target="_blank" rel="noreferrer" className="underline">
              Depop listing saved to Drive
            </a>
          </div>
        )}
      </div>

      <GenerateSkuDialog
        isOpen={isSkuDialogOpen}
        onClose={() => setIsSkuDialogOpen(false)}
        onGenerated={(newSku) => setSku(newSku)}
      />
    </div>
  );
}
