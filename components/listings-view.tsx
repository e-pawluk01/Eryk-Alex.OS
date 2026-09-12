"use client";

export function ListingsView() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Listings</h2>
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-muted-foreground uppercase tracking-widest text-xs">
          Listing generator coming in the next phase.
        </p>
      </div>
    </div>
  );
}
