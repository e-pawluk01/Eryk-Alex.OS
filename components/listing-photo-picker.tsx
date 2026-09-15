"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";

export const MAX_PHOTOS = 3;

export interface PhotoSlot {
  id: string;
  file: File;
  previewUrl: string;
}

interface ListingPhotoPickerProps {
  photos: PhotoSlot[];
  onChange: (photos: PhotoSlot[]) => void;
}

// Real phone photos routinely add up to more than Vercel's ~4.5MB request
// limit once you have 2-3 of them. Shrink before they ever leave the
// browser; fall back to the original file if a photo can't be decoded
// client-side (e.g. some HEIC cases) rather than blocking the upload.
async function compressImage(file: File, maxDimension = 1280, quality = 0.7): Promise<File> {
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
}

export function ListingPhotoPicker({ photos, onChange }: ListingPhotoPickerProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onChange([...photos, ...newSlots]);
  };

  const removePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((p) => p.id !== id));
  };

  return (
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
  );
}
