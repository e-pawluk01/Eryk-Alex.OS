"use client";

import React from "react";
import { useHoverTip } from "../ui/hover-tip";
import {
  CHART_HEIGHT, AXIS_TEXT, LABEL_TEXT, GRID_LINE, BASE_LINE, niceScale, topRoundedBar, rightRoundedBar,
} from "./chart-frame";

export interface ColumnSeries {
  name: string;
  // One colour, or one per category (e.g. a colour per profit band).
  color: string | string[];
  values: number[];
}

interface ColumnChartProps {
  width: number;
  categories: string[];
  series: ColumnSeries[];
  stacked?: boolean;
  axisFormat: (v: number) => string;
  tip: (category: number, series: number) => string;
}

// Vertical bars: side by side per category, or stacked with a 2px gap
// between segments. Every bar shows a hover pop-up.
export function ColumnChart({ width, categories, series, stacked, axisFormat, tip }: ColumnChartProps) {
  const { bind, layer } = useHoverTip();
  const pad = { t: 10, r: 8, b: 26, l: 44 };
  const plotW = width - pad.l - pad.r;
  const plotH = CHART_HEIGHT - pad.t - pad.b;

  const tops = categories.map((_, c) =>
    stacked ? series.reduce((acc, s) => acc + s.values[c], 0) : Math.max(...series.map((s) => s.values[c]))
  );
  const { max, ticks } = niceScale(Math.max(0, ...tops));
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const slot = plotW / categories.length;
  const barW = stacked ? Math.min(44, slot * 0.42) : Math.min(22, (slot * 0.56) / series.length);
  const colorOf = (s: ColumnSeries, c: number) => (Array.isArray(s.color) ? s.color[c] : s.color);
  const labelSize = width < 420 && categories.length > 5 ? 9 : 11;

  return (
    <>
      <svg width={width} height={CHART_HEIGHT} role="img" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE_LINE : GRID_LINE} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>{axisFormat(t)}</text>
          </g>
        ))}

        {categories.map((cat, c) => {
          const centre = pad.l + slot * c + slot / 2;
          let base = y(0);
          return (
            <g key={cat}>
              {series.map((s, i) => {
                const v = s.values[c];
                const h = (v / max) * plotH;
                if (h <= 0) return null;
                if (stacked) {
                  const isTop = series.slice(i + 1).every((later) => later.values[c] <= 0);
                  const x = centre - barW / 2;
                  const top = base - h;
                  base = top;
                  return isTop ? (
                    <path key={s.name} d={topRoundedBar(x, top, barW, h)} fill={colorOf(s, c)} {...bind(tip(c, i))} />
                  ) : (
                    <rect key={s.name} x={x} y={top + 2} width={barW} height={Math.max(h - 2, 0)} fill={colorOf(s, c)} {...bind(tip(c, i))} />
                  );
                }
                const x = centre - (barW * series.length + (series.length - 1)) / 2 + i * (barW + 1);
                return <path key={s.name} d={topRoundedBar(x, y(v), barW, h)} fill={colorOf(s, c)} {...bind(tip(c, i))} />;
              })}
              <text x={centre} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize={labelSize} fill={LABEL_TEXT}>{cat}</text>
            </g>
          );
        })}
      </svg>
      {layer}
    </>
  );
}

interface BarRow {
  label: string;
  value: number;
  color: string;
}

// Horizontal bars with the value written at the end of each bar.
export function HorizontalBars({ width, rows, format }: { width: number; rows: BarRow[]; format: (v: number) => string }) {
  const { bind, layer } = useHoverTip();
  const labelW = width < 420 ? 104 : 132;
  const valueW = 84;
  const plotW = Math.max(40, width - labelW - valueW);
  const barH = 18;
  const gap = (CHART_HEIGHT - 48 - barH * rows.length) / Math.max(1, rows.length - 1);
  const { max } = niceScale(Math.max(0, ...rows.map((r) => r.value)));

  return (
    <>
      <svg width={width} height={CHART_HEIGHT} role="img" className="block">
        {rows.map((r, i) => {
          const top = 24 + i * (barH + gap);
          const w = (Math.max(0, r.value) / max) * plotW;
          return (
            <g key={r.label}>
              <text x={0} y={top + 13} fontSize={12} fill="#e5e5e5">{r.label}</text>
              <rect x={labelW} y={top} width={plotW} height={barH} rx={4} fill="rgba(255,255,255,0.04)" />
              <path d={rightRoundedBar(labelW, top, w, barH)} fill={r.color} {...bind(`${r.label}\n${format(r.value)}`)} />
              <text x={labelW + w + 8} y={top + 13} fontSize={12} fontWeight={600} fill="#ffffff">{format(r.value)}</text>
            </g>
          );
        })}
      </svg>
      {layer}
    </>
  );
}
