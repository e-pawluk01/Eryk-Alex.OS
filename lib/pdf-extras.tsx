import React from 'react';
import { Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PRINT, SplitBar } from './pdf-charts';
import { styles, Metric, Section, ChartHead, fmtCurrency } from './pdf-parts';
import { categoryColor } from './categories';
import { bestCategory, sortCategories, type CategoryRank, type Ranking } from './category-ranking';
import type { ReportExtras } from './report-extras';

// The report's two newer pages: "Stock & categories" and "Categories in full".

const x = StyleSheet.create({
  two: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  panel: { width: 253, borderWidth: 1, borderColor: '#e7e3da', borderRadius: 4, padding: 9 },
  quad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quadCell: { width: 253, borderWidth: 1, borderColor: '#e7e3da', borderRadius: 4, padding: 8, marginBottom: 9 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  name: { width: 64, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 4.5, height: 4.5, borderRadius: 3, marginRight: 4 },
  nameText: { fontSize: 7, color: '#111111' },
  track: { flexGrow: 1, height: 6.5, backgroundColor: '#f3f1ec', borderRadius: 1.5, position: 'relative' },
  value: { width: 46, fontSize: 7, fontWeight: 'bold', textAlign: 'right' },
  valueMuted: { fontWeight: 'normal', color: '#999999' },
  keys: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 1 },
  keyItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  keyText: { fontSize: 7, color: '#666666' },
  note: { fontSize: 7.5, color: '#666666', marginTop: 5 },
  hRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hLabel: { width: 40, fontSize: 8 },
  hTrack: { flexGrow: 1, height: 10, backgroundColor: '#f3f1ec', borderRadius: 2 },
  hValue: { width: 26, fontSize: 8, fontWeight: 'bold', textAlign: 'right' },
  cellBox: { borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#e7e3da', paddingVertical: 2.4, paddingHorizontal: 5 },
  cellText: { fontSize: 7.5 },
  cellSub: { fontSize: 6, color: '#999999', marginTop: 1 },
  inlineBadge: {
    fontSize: 5.25, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 4,
    borderWidth: 0.6, borderColor: '#cfc9bd', borderRadius: 5, paddingHorizontal: 3, paddingVertical: 0.5,
  },
});

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
// The PDF's built-in Helvetica has no Unicode minus sign, so a plain hyphen.
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)}`;
const short = (name: string) => name.replace(' & t-shirts', '').replace(' & nightwear', '').replace(' & Sweaters', '');
const daysText = (c: CategoryRank, r: Ranking) =>
  c.daysReached && c.blendedDays !== null ? `${Math.round(c.blendedDays)} days` : `over ${Math.round(c.days ?? r.business.medianDays ?? 0)}`;
const SIGNAL: Record<CategoryRank['signal'], string> = { More: '#1f8a5c', Less: '#c0503a', Watch: '#7a766d' };

type Bar = { c: CategoryRank; value: number | null; label: string };

function MiniBars({ title, bars, avg }: { title: string; bars: Bar[]; avg: number | null }) {
  const max = Math.max(...bars.map((b) => b.value ?? 0), avg ?? 0, 1) * 1.08;
  return (
    <View style={x.quadCell}>
      <ChartHead title={title} />
      {bars.map(({ c, value, label }) => (
        <View key={c.name} style={x.row}>
          <View style={x.name}>
            <View style={[x.dot, { backgroundColor: categoryColor(c.name) }]} />
            <Text style={x.nameText}>{short(c.name)}</Text>
          </View>
          <View style={x.track}>
            {value !== null && (
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(value / max) * 100}%`,
                backgroundColor: categoryColor(c.name), opacity: c.early ? 0.4 : 1, borderRadius: 1.5 }} />
            )}
            {avg !== null && (
              <View style={{ position: 'absolute', left: `${(avg / max) * 100}%`, top: -2, bottom: -2,
                borderLeftWidth: 0.8, borderLeftColor: '#6f6b62', borderStyle: 'dashed' }} />
            )}
          </View>
          <Text style={[x.value, value === null ? x.valueMuted : {}]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StockCategoriesPage({ extras, monthLabel, header, footer }: {
  extras: ReportExtras; monthLabel: string; header: React.ReactNode; footer: React.ReactNode;
}) {
  const { health: h, ranking: r } = extras;
  const st = h.sellThrough, dts = h.daysToSell, aged = h.aged, added = h.added;
  const cats = r.categories.filter((c) => c.name !== 'Other' && c.sold > 0);
  const sorted = (get: (c: CategoryRank) => number) =>
    [...cats].sort((a, b) => get(b) - get(a));
  const known = cats.filter((c) => c.daysReached && c.blendedDays !== null).sort((a, b) => a.blendedDays! - b.blendedDays!);
  const waiting = cats.filter((c) => !known.includes(c)).sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  const best = (key: Parameters<typeof bestCategory>[1]) => bestCategory(r.categories, key);
  const card = (label: string, key: Parameters<typeof bestCategory>[1], sub: (c: CategoryRank) => string) => {
    const c = best(key);
    return <Metric label={label} small value={c ? c.name : '—'} muted={!c} sub={c ? sub(c) : undefined} badge={c?.early ? 'Early read' : undefined} />;
  };

  return (
    <Page size="A4" style={styles.page}>
      {header}
      <Section label="Stock Health" caption={h.window.rolling ? 'Last 30 days' : monthLabel}>
        <View style={styles.grid}>
          <Metric label="Sell-Through" value={st.value !== null ? pct(st.value) : '—'} muted={st.value === null}
            sub={`${st.sold} of ${st.sold + st.stock + st.removed}`} />
          {dts.status === 'ready'
            ? <Metric label="Days to Sell" value={dts.reached ? `${dts.median} days` : `Over ${dts.median} days`}
                sub={dts.reached ? `${dts.measured} sales measured` : 'Half not sold yet'} />
            : <Metric label="Days to Sell" value="—" muted sub="Collecting data" />}
          {aged.status === 'ready'
            ? <Metric label="Aged Stock" value={`${aged.count} items`} sub={`${fmtCurrency(aged.cash)} tied up`} />
            : <Metric label="Aged Stock" value="—" muted sub="Collecting data" />}
          <Metric label="Items Added" value={String(added.added)} sub={`${added.sold} sold · ${signed(added.net)} net`} />
        </View>
        <View style={x.two}>
          <View style={x.panel}>
            <ChartHead title="Items added vs sold" />
            {[{ label: 'Added', value: added.added, color: PRINT.blue }, { label: 'Sold', value: added.sold, color: PRINT.orange }].map((b) => (
              <View key={b.label} style={x.hRow}>
                <Text style={x.hLabel}>{b.label}</Text>
                <View style={x.hTrack}>
                  <View style={{ width: `${(b.value / Math.max(added.added, added.sold, 1)) * 100}%`, height: 10, backgroundColor: b.color, borderRadius: 2 }} />
                </View>
                <Text style={x.hValue}>{b.value}</Text>
              </View>
            ))}
          </View>
          <View style={x.panel}>
            <SplitBar label="Where the stock went" format={(v) => String(v)} items={[
              { label: 'Sold', value: st.sold, color: PRINT.orange, strong: true },
              { label: 'Still in stock', value: st.stock, color: PRINT.blue },
              { label: 'Removed', value: st.removed, color: PRINT.other },
            ]} />
            <Text style={x.note}>Months of cover: {added.cover !== null ? added.cover.toFixed(1) : '—'}</Text>
          </View>
        </View>
      </Section>

      <Section label="Categories" caption={extras.windowLabel}>
        <View style={[styles.grid, { marginBottom: 9 }]}>
          {card('Profit per Item Stocked', 'perItem', (c) => `${fmtCurrency(c.perItem)} per item · ${c.sold} of ${c.stocked} sold`)}
          {card('Sell-Through', 'sellThrough', (c) => `${pct(c.sellThrough)} · ${c.sold} of ${c.stocked} sold`)}
          {card('Profit per Sale', 'perSale', (c) => `${fmtCurrency(c.perSale)} per sale · ${c.sold} sold`)}
          {card('Fastest Seller', 'days', (c) => `${daysText(c, r)} · ${c.sold} sold`)}
        </View>
        {cats.length === 0 ? <Text style={styles.empty}>No sales in this window yet.</Text> : (
          <>
            <View style={x.quad}>
              <MiniBars title="Profit per item stocked" avg={r.business.perItem}
                bars={sorted((c) => c.perItem).map((c) => ({ c, value: c.perItem, label: fmtCurrency(c.perItem) }))} />
              <MiniBars title="Sell-through" avg={r.business.sellThrough * 100}
                bars={sorted((c) => c.sellThrough).map((c) => ({ c, value: c.sellThrough * 100, label: pct(c.sellThrough) }))} />
              <MiniBars title="Profit per sale" avg={r.business.perSale}
                bars={sorted((c) => c.perSale).map((c) => ({ c, value: c.perSale, label: fmtCurrency(c.perSale) }))} />
              <MiniBars title="Days to sell, fastest first" avg={null}
                bars={[...known.map((c) => ({ c, value: c.blendedDays!, label: `${Math.round(c.blendedDays!)} days` })),
                  ...waiting.map((c) => ({ c, value: null, label: 'Not known' }))]} />
            </View>
            <View style={x.keys}>
              <View style={x.keyItem}><View style={[x.dot, { backgroundColor: '#c98500' }]} /><Text style={x.keyText}>Enough data</Text></View>
              <View style={x.keyItem}><View style={[x.dot, { backgroundColor: '#c98500', opacity: 0.4 }]} /><Text style={x.keyText}>Early read</Text></View>
              <View style={x.keyItem}>
                <View style={{ width: 0, height: 8, borderLeftWidth: 0.8, borderLeftColor: '#6f6b62', borderStyle: 'dashed', marginRight: 4 }} />
                <Text style={x.keyText}>Business average</Text>
              </View>
              <Text style={x.keyText}>"Not known" = fewer than half have sold yet</Text>
            </View>
          </>
        )}
      </Section>
      {footer}
    </Page>
  );
}

export function CategoriesTablePage({ extras, header, footer }: {
  extras: ReportExtras; header: React.ReactNode; footer: React.ReactNode;
}) {
  const r = extras.ranking;
  const rows = sortCategories(r.categories, 'perItem').filter((c) => c.name !== 'Other');
  const cols: [string, number, boolean][] = [
    ['Category', 24, false], ['Signal', 9, false], ['Profit / item', 10, true], ['Sell-through', 13, true],
    ['Profit / sale', 12, true], ['Days to sell', 10, true], ['Aged', 6, true], ['Total profit', 9, true], ['ABC', 7, true],
  ];
  const Cell = ({ i, main, sub, color, bold }: { i: number; main: React.ReactNode; sub?: string; color?: string; bold?: boolean }) => (
    <View style={[x.cellBox, { width: `${cols[i][1]}%` }]}>
      <Text style={[x.cellText, { textAlign: cols[i][2] ? 'right' : 'left' }, color ? { color } : {}, bold ? { fontWeight: 'bold' } : {}]}>{main}</Text>
      {sub ? <Text style={[x.cellSub, { textAlign: cols[i][2] ? 'right' : 'left' }]}>{sub}</Text> : null}
    </View>
  );

  return (
    <Page size="A4" style={styles.page}>
      {header}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Categories in Full</Text>
        <Text style={styles.sectionCaption}>{extras.windowLabel} · sorted by profit per item stocked</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.row}>
          {cols.map(([h, w, right]) => (
            <Text key={h} style={[styles.cell, styles.headCell, { width: `${w}%`, textAlign: right ? 'right' : 'left', paddingHorizontal: 5, letterSpacing: 0.3 }]}>{h}</Text>
          ))}
        </View>
        {rows.map((c) => (
          <View key={c.name} style={styles.row} wrap={false}>
            <View style={[x.cellBox, { width: `${cols[0][1]}%` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[x.dot, { backgroundColor: categoryColor(c.name) }]} />
                <Text style={x.cellText}>{c.name}</Text>
                {c.early && c.name.length <= 15 ? <Text style={x.inlineBadge}>Early read</Text> : null}
              </View>
              {/* A long name has no room beside it, so its badge goes underneath. */}
              {c.early && c.name.length > 15 ? <Text style={[x.inlineBadge, { alignSelf: 'flex-start', marginLeft: 8.5, marginTop: 2 }]}>Early read</Text> : null}
            </View>
            <Cell i={1} main={c.signal} color={SIGNAL[c.signal]} bold />
            <Cell i={2} main={fmtCurrency(c.perItem)} />
            <Cell i={3} main={pct(c.sellThrough)} sub={`${c.sold} / ${c.stocked}`} />
            <Cell i={4} main={fmtCurrency(c.perSale)} sub={c.actualPerSale === null ? 'no sales' : `${fmtCurrency(c.actualPerSale)} actual`} />
            <Cell i={5} main={daysText(c, r)} />
            <Cell i={6} main={c.aged === null ? '—' : String(c.aged)} />
            <Cell i={7} main={`£${Math.round(c.profit).toLocaleString('en-GB')}`} />
            <Cell i={8} main={c.abc} />
          </View>
        ))}
      </View>
      <Text style={[x.note, { marginBottom: 14 }]}>
        Signal: More earns above the business average · Less below · Watch too little data yet. ABC: A = categories making the first 80% of profit, B the next 15%, C the last 5%.
      </Text>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Top 5 Flips</Text>
      </View>
      {extras.flips.length === 0 ? <Text style={styles.empty}>No sales in this window yet.</Text> : (
        <View style={styles.table}>
          <View style={styles.row}>
            {[['SKU', 18], ['Category', 26], ['Paid', 14], ['Sold for', 14], ['Profit', 14], ['Margin', 14]].map(([h, w], i) => (
              <Text key={h} style={[styles.cell, styles.headCell, { width: `${w}%`, textAlign: i > 1 ? 'right' : 'left' }]}>{h}</Text>
            ))}
          </View>
          {extras.flips.map((f, i) => (
            <View key={`${f.sku}-${i}`} style={styles.row}>
              <Text style={[styles.cell, { width: '18%' }]}>{f.sku}</Text>
              <Text style={[styles.cell, { width: '26%' }]}>{f.category}</Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>{fmtCurrency(f.paid)}</Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>{fmtCurrency(f.sold)}</Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>{fmtCurrency(f.profit)}</Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>{f.sold > 0 ? `${Math.round((f.profit / f.sold) * 100)}%` : '—'}</Text>
            </View>
          ))}
        </View>
      )}
      {footer}
    </Page>
  );
}
