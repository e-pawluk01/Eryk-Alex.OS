import React from "react";
import { ContextType } from "@/lib/types";
import { cn } from "@/lib/utils";

const contextColors: Record<ContextType, string> = {
  "Eryk": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Alex": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Reselling": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Drink idea": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function ContextTag({ context, className }: { context: ContextType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider",
        contextColors[context],
        className
      )}
    >
      {context}
    </span>
  );
}
