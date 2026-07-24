"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalContext, ContextType } from "./global-context";
import { cn } from "@/lib/utils";

const contexts: ContextType[] = [
  "All",
  "Study (Person A)",
  "Study (Person B)",
  "Business 1",
  "Business 2",
];

export function Navbar() {
  const pathname = usePathname();
  const { currentContext, setCurrentContext } = useGlobalContext();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-500 opacity-40 hover:opacity-100 focus-within:opacity-100">
      <div className="flex items-center gap-2 bg-secondary/50 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-2xl">
        
        {/* Navigation Pills */}
        <div className="flex items-center bg-black/80 rounded-full p-1 border border-white/5">
          <Link 
            href="/"
            className={cn(
              "px-5 py-2 text-xs font-semibold tracking-widest uppercase rounded-full transition-all duration-300",
              pathname === "/" 
                ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                : "text-neutral-500 hover:text-white hover:bg-white/10"
            )}
          >
            Home
          </Link>
          <Link 
            href="/tasks"
            className={cn(
              "px-5 py-2 text-xs font-semibold tracking-widest uppercase rounded-full transition-all duration-300",
              pathname === "/tasks" 
                ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                : "text-neutral-500 hover:text-white hover:bg-white/10"
            )}
          >
            Tasks
          </Link>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Context Switcher Pills */}
        <div className="flex items-center bg-black/80 rounded-full p-1 border border-white/5">
          {contexts.map((ctx) => (
            <button
              key={ctx}
              onClick={() => setCurrentContext(ctx)}
              className={cn(
                "px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-all duration-300 cursor-pointer",
                currentContext === ctx
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                  : "text-neutral-500 hover:text-white hover:bg-white/10"
              )}
            >
              {ctx}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
