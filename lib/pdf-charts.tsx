import React from 'react';
import { View, Text, Svg, Path, Rect, Line, Text as SvgText, StyleSheet } from '@react-pdf/renderer';

// The app's chart colours, stepped for a white page.
export const PRINT = {
  blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100',
  magenta: '#e87ba4', green: '#008300', violet: '#4a3aa7', red: '#e34948', other: '#8d8a83',
};

const TASK_PRINT: Record<string, string> = {
  'Listing': PRINT.blue, 'Photography': PRINT.orange, 'Sourcing': PRINT.aqua,
  'Cleaning / Restoration': PRINT.yellow, 'Packing / Shipping': PRINT.magenta, 'Admin': PRINT.green,
  'Content': PRINT.violet, 'Development': PRINT.red, 'Other': PRINT.other,
};
export const taskPrint = (task: string) => TASK_PRINT[task] ?? PRINT.other;

const s = StyleSheet.create({
  miniLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 5 },
  stack: { flexDirection: 'row', height: 7, marginBottom: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  legendName: { fontSize: 8, flexGrow: 1 },
  legendValue: { fontSize: 8, width: 44, textAlign: 'right' },
  legendPct: { fontSize: 8, width: 24, textAlign: 'right', color: '#999999' },
  empty: { fontSize: 8, color: '#999999' },
});

export interface SplitItem { label: string; value: number; color: string; strong?: boolean }

// Stacked colour bar + legend with amount and share — page 1's breakdowns.
export function SplitBar({ label, items, format, columns = 2 }: {
  label: string; items: SplitItem[]; format: (v: number) => string; columns?: 1 | 2;
}) {
  const shown = items.filter((i) => i.value > 0);
  const total = shown.reduce((a, i) => a + i.value, 0);
  return (
    <View>
      <Text style={s.miniLabel}>{label}</Text>
      {shown.length === 0 ? <Text style={s.empty}>Nothing logged this month.</Text> : (
        <>
          <View style={s.stack}>
            {shown.map((i, n) => (
              <View key={i.label} style={{
                flexGrow: i.value, backgroundColor: i.color, marginRight: n < shown.length - 1 ? 1.5 : 0,
                borderTopLeftRadius: n === 0 ? 2 : 0, borderBottomLeftRadius: n === 0 ? 2 : 0,
                borderTopRightRadius: n === shown.length - 1 ? 2 : 0, borderBottomRightRadius: n === shown.length - 1 ? 2 : 0,
              }} />
            ))}
          </View>
          <View style={s.legend}>
            {shown.map((i) => (
              <View key={i.label} style={[s.legendRow, { width: columns === 2 ? '50%' : '100%' }]}>
                <View style={[s.dot, { backgroundColor: i.color }]} />
                <Text style={[s.legendName, i.strong ? { fontWeight: 'bold' } : {}]}>{i.label}</Text>
                <Text style={[s.legendValue, i.strong ? { fontWeight: 'bold' } : {}]}>{format(i.value)}</Text>
                <Text style={s.legendPct}>{Math.round((i.value / total) * 100)}%</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// A round-number axis top, split into about four steps.
function niceScale(maxValue: number) {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= rough) ?? 10 * mag;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { max, ticks };
}

const topBar = (x: number, y: number, w: number, h: number, r = 2.5) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

export interface PdfSeries { color: string | string[]; values: number[] }

// Vertical bars, side by side or stacked — page 2's column charts.
export function ColumnChart({ width, height, categories, series, stacked, axis }: {
  width: number; height: number; categories: string[]; series: PdfSeries[]; stacked?: boolean; axis: (v: number) => string;
}) {
  const pad = { t: 6, r: 4, b: 17, l: 32 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const tops = categories.map((_, c) =>
    stacked ? series.reduce((a, x) => a + x.values[c], 0) : Math.max(...series.map((x) => x.values[c])));
  const { max, ticks } = niceScale(Math.max(0, ...tops));
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const slot = plotW / categories.length;
  const barW = stacked ? Math.min(30, slot * 0.42) : Math.min(15, (slot * 0.56) / series.length);
  const colorOf = (x: PdfSeries, c: number) => (Array.isArray(x.color) ? x.color[c] : x.color);

  return (
    <Svg width={width} height={height}>
      {ticks.map((t) => (
        <React.Fragment key={t}>
          <Line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9c4b8' : '#ece9e2'} strokeWidth={0.75} />
          <SvgText x={pad.l - 5} y={y(t) + 2.5} textAnchor="end" style={{ fontSize: 7, fontFamily: 'Helvetica' }} fill="#9a978f">{axis(t)}</SvgText>
        </React.Fragment>
      ))}
      {categories.map((cat, c) => {
        const centre = pad.l + slot * c + slot / 2;
        let base = y(0);
        return (
          <React.Fragment key={cat}>
            {series.map((x, i) => {
              const v = x.values[c];
              const h = (v / max) * plotH;
              if (h <= 0) return null;
              if (stacked) {
                const isTop = series.slice(i + 1).every((later) => later.values[c] <= 0);
                const top = base - h;
                base = top;
                return isTop
                  ? <Path key={i} d={topBar(centre - barW / 2, top, barW, h)} fill={colorOf(x, c)} />
                  : <Rect key={i} x={centre - barW / 2} y={top + 1.1} width={barW} height={Math.max(h - 1.1, 0)} fill={colorOf(x, c)} />;
              }
              const bx = centre - (barW * series.length + series.length - 1) / 2 + i * (barW + 1);
              return <Path key={i} d={topBar(bx, y(v), barW, h)} fill={colorOf(x, c)} />;
            })}
            <SvgText x={centre} y={height - 4} textAnchor="middle" style={{ fontSize: 7.5, fontFamily: 'Helvetica' }} fill="#6f6c65">{cat}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// Horizontal bars with the amount written at the end — the stock chart.
export function HorizontalBars({ width, rows, format }: {
  width: number; rows: { label: string; value: number; color: string }[]; format: (v: number) => string;
}) {
  const labelW = 96, valueW = 60, barH = 13, height = 88;
  const plotW = width - labelW - valueW;
  const gap = (height - 14 - barH * rows.length) / Math.max(1, rows.length - 1);
  const { max } = niceScale(Math.max(0, ...rows.map((r) => r.value)));
  return (
    <Svg width={width} height={height}>
      {rows.map((r, i) => {
        const top = 7 + i * (barH + gap);
        const w = (Math.max(0, r.value) / max) * plotW;
        return (
          <React.Fragment key={r.label}>
            <SvgText x={0} y={top + 9} style={{ fontSize: 8.25, fontFamily: 'Helvetica' }} fill="#111111">{r.label}</SvgText>
            <Rect x={labelW} y={top} width={plotW} height={barH} rx={2.5} fill="#f3f1ec" />
            {w > 0 && <Rect x={labelW} y={top} width={w} height={barH} rx={2.5} fill={r.color} />}
            <SvgText x={labelW + w + 5} y={top + 9} style={{ fontSize: 8.25, fontFamily: 'Helvetica-Bold' }} fill="#111111">{format(r.value)}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
