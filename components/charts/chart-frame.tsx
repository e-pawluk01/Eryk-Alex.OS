"use client";

import React, { useEffect, useRef, useState } from "react";

export const CHART_HEIGHT = 240;
export const AXIS_TEXT = "#8a8a8a";
export const LABEL_TEXT = "#a3a3a3";
export const GRID_LINE = "rgba(255,255,255,0.06)";
export const BASE_LINE = "rgba(255,255,255,0.18)";

interface ChartFrameProps {
  title: string;
  sub?: string;
  legend?: { label: string; color: string }[];
  // Shown instead of the chart when there's nothing to plot.
  empty?: string;
  children: (width: number) => React.ReactNode;
}

// Card-styled box for a section's chart: title, legend, then the drawing,
// sized to the box's own width so it never squashes on a phone.
export function ChartFrame({ title, sub, legend, empty, children }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl px-[18px] pt-[18px] pb-3 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-medium text-foreground">{title}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {legend && !empty && (
          <div className="flex flex-wrap gap-3.5 text-[11px] text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div ref={ref} style={{ height: CHART_HEIGHT }} className="relative">
        {empty ? (
          <p className="absolute inset-0 grid place-items-center text-[13px] text-muted-foreground/60">{empty}</p>
        ) : (
          width > 0 && children(width)
        )}
      </div>
    </div>
  );
}

// A round-number top for the value axis, split into about four steps.
export function niceScale(maxValue: number) {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { max, ticks };
}

// Bar path with only the top corners rounded, so it sits flat on the axis.
export function topRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function rightRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}
