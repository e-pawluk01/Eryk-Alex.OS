"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { GenerateSkuDialog } from "@/components/generate-sku-dialog";

const MAX_PHOTOS = 3;

interface PhotoSlot {
  id: string;
  file: File;
  previewUrl: string;
}

export function ListingsView() {
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Listings</h2>
        <button
          onClick={() => setIsSkuDialogOpen(true)}
          className="border border-white/10 text-white/60 text-[9.5px] font-bold uppercase tracking-widest px-3.5 py-2 rounded-lg hover:text-white hover:border-white/30 transition-colors"
        >
          Generate SKU
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          addPhotos(e.dataTransfer.files);
        }}
        className={`max-w-2xl w-full bg-[#111] border rounded-2xl p-6 flex flex-col gap-3 transition-colors ${
          isDragActive ? "border-white/40" : "border-white/5"
        }`}
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
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-muted-foreground uppercase tracking-widest text-xs">
          Category, brand, and the rest of the listing form come next.
        </p>
      </div>

      <GenerateSkuDialog isOpen={isSkuDialogOpen} onClose={() => setIsSkuDialogOpen(false)} />
    </div>
  );
}
