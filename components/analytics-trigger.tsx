"use client";

import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalyticsPanel } from "./analytics-panel";

export function AnalyticsTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-0 top-[40%] -translate-y-1/2 bg-white/5 hover:bg-white/10 border border-white/10 border-r-0 backdrop-blur-md",
          "rounded-l-lg py-4 px-3 cursor-pointer z-40 transition-all duration-300",
          isOpen ? "translate-x-full" : "translate-x-0"
        )}
        title="View Analytics"
      >
        <TrendingUp className="w-5 h-5 text-emerald-400/80" />
      </button>

      <AnalyticsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
