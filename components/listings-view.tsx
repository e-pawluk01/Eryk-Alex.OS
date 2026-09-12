"use client";

import { useState } from "react";
import { GenerateSkuDialog } from "@/components/generate-sku-dialog";

export function ListingsView() {
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);

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

      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-muted-foreground uppercase tracking-widest text-xs">
          Listing generator coming in the next phase.
        </p>
      </div>

      <GenerateSkuDialog isOpen={isSkuDialogOpen} onClose={() => setIsSkuDialogOpen(false)} />
    </div>
  );
}
