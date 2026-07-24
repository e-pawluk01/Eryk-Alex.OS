"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CustomCheckbox({ checked, onChange, className }: CustomCheckboxProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border transition-colors",
        checked ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-white/5",
        className
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </div>
  );
}
