"use client";

import React from "react";
import { useGlobalContext, DomainType } from "./global-context";
import { cn } from "@/lib/utils";
import { Briefcase, BookOpen, MonitorPlay } from "lucide-react";

export function Navbar() {
  const { currentDomain, setCurrentDomain } = useGlobalContext();

  const domains: { id: DomainType; icon: React.ReactNode }[] = [
    { id: "WORK", icon: <Briefcase className="w-4 h-4" /> },
    { id: "STUDY", icon: <BookOpen className="w-4 h-4" /> },
    { id: "CONTENT", icon: <MonitorPlay className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-500 opacity-30 hover:opacity-100 focus-within:opacity-100">
      <div className="flex items-center bg-secondary/50 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-2xl">
        <div className="flex items-center bg-black/80 rounded-full p-1 border border-white/5 gap-1">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setCurrentDomain(domain.id)}
              className={cn(
                "p-3 rounded-full transition-all duration-300 cursor-pointer",
                currentDomain === domain.id
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                  : "text-neutral-500 hover:text-white hover:bg-white/10"
              )}
              title={domain.id}
            >
              {domain.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
