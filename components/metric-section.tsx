import React from "react";

interface MetricSectionProps {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
}

// Shared wrapper for a titled block of MetricCards on the analytics dashboard.
// Matches the existing heading + 2x4 grid pattern; first section sits flush,
// the rest are separated by mt-8.
export function MetricSection({ title, loading, children }: MetricSectionProps) {
  return (
    <div className="flex flex-col gap-4 mt-8 first:mt-0">
      <div className="flex items-center border-b border-border pb-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      </div>
      <div
        className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity duration-300 ${
          loading ? "opacity-50" : "opacity-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
