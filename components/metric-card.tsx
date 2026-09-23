import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ChevronDown } from "lucide-react";

export interface MetricComparison {
  percentage: number;
  direction: "up" | "down";
  // good = green, bad = red, neutral = grey (e.g. hours: more isn't better or worse)
  tone: "good" | "bad" | "neutral";
  label: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  className?: string;
  comparison?: MetricComparison | null;
  // Grey line under the value (e.g. Top Task's hours and share).
  sub?: string;
  // Smaller value text, for words like "Listing" or "1h 31m".
  compact?: boolean;
  // Makes the card tappable; its details open underneath the section.
  onClick?: () => void;
  expanded?: boolean;
}

export function MetricCard({ title, value, prefix, suffix, className, comparison, sub, compact, onClick, expanded }: MetricCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-expanded": !!expanded } : {})}
      className={cn(
        "flex flex-col gap-1 bg-[#111] border border-white/5 rounded-xl p-4 relative overflow-hidden text-left",
        onClick && "hover:border-white/15 transition-colors",
        expanded && "border-white/20 hover:border-white/20",
        className
      )}
    >
      <h3 className={cn("text-[10px] font-bold uppercase tracking-widest text-muted-foreground", onClick && "pr-5")}>
        {title}
      </h3>
      {onClick && (
        <ChevronDown
          className={cn(
            "absolute top-3.5 right-3 w-3.5 h-3.5 transition-transform duration-200",
            expanded ? "rotate-180 text-white" : "text-muted-foreground/50"
          )}
        />
      )}
      <div className="flex items-baseline gap-1 mt-1 min-w-0">
        {prefix && <span className="text-sm text-muted-foreground/50 font-medium">{prefix}</span>}
        <span className={cn("font-semibold tracking-tight text-white truncate", compact ? "text-xl" : "text-2xl")}>{value}</span>
        {suffix && <span className="text-sm text-muted-foreground/50 font-medium">{suffix}</span>}
      </div>
      
      {comparison && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-[10px] uppercase font-bold tracking-widest",
          comparison.tone === "good" && "text-emerald-400/80",
          comparison.tone === "bad" && "text-red-400/80",
          comparison.tone === "neutral" && "text-muted-foreground/75"
        )}>
          {comparison.direction === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span>{comparison.percentage.toFixed(1)}% {comparison.label}</span>
        </div>
      )}
      {!comparison && sub && (
        <div className="mt-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50 truncate">{sub}</div>
      )}
    </Tag>
  );
}
