"use client";

import React from "react";
import { useGlobalContext, ContextType } from "./global-context";
import { cn } from "@/lib/utils";

const contexts: ContextType[] = [
  "All",
  "Study (Person A)",
  "Study (Person B)",
  "Business 1",
  "Business 2",
];

export function ContextSwitcher() {
  const { currentContext, setCurrentContext } = useGlobalContext();

  return (
    <div className="flex items-center justify-center p-1">
      <div className="flex items-center bg-secondary rounded-full p-1 border border-border">
        {contexts.map((ctx) => (
          <button
            key={ctx}
            onClick={() => setCurrentContext(ctx)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer",
              currentContext === ctx
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {ctx}
          </button>
        ))}
      </div>
    </div>
  );
}
