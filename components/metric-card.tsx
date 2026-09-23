import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ChevronDown } from "lucide-react";

export interface MetricComparison {
  percentage: number;
  isPositive: boolean;
  label: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  className?: string;
  comparison?: MetricComparison | null;
  // Makes the card tappable; its details open underneath the section.
  onClick?: () => void;
  expanded?: boolean;
}

export function MetricCard({ title, value, prefix, suffix, className, comparison, onClick, expanded }: MetricCardProps) {
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
      <div className="flex items-baseline gap-1 mt-1">
        {prefix && <span className="text-sm text-muted-foreground/50 font-medium">{prefix}</span>}
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground/50 font-medium">{suffix}</span>}
      </div>
      
      {comparison && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-[10px] uppercase font-bold tracking-widest",
          comparison.isPositive ? "text-emerald-400/80" : "text-red-400/80"
        )}>
          {comparison.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span>{comparison.percentage.toFixed(1)}% {comparison.label}</span>
        </div>
      )}
    </Tag>
  );
}
