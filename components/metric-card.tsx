import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function MetricCard({ title, value, prefix, suffix, className }: MetricCardProps) {
  return (
    <div className={cn("flex flex-col gap-1 bg-[#111] border border-white/5 rounded-xl p-4 relative overflow-hidden", className)}>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="flex items-baseline gap-1 mt-1">
        {prefix && <span className="text-sm text-muted-foreground/50 font-medium">{prefix}</span>}
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground/50 font-medium">{suffix}</span>}
      </div>
    </div>
  );
}
