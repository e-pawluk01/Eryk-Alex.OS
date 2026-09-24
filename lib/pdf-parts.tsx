import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

// Shared look and small building blocks for the monthly report PDF.
export const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', paddingTop: 40, paddingHorizontal: 40, paddingBottom: 64, fontFamily: 'Helvetica', color: '#111111' },

  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cfc9bd', paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 11, color: '#666666', textTransform: 'uppercase', letterSpacing: 2 },
  running: {
    flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#cfc9bd',
    paddingBottom: 8, marginBottom: 16,
  },
  runningText: { fontSize: 8, color: '#999999', textTransform: 'uppercase', letterSpacing: 1.4 },

  section: { marginBottom: 13 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#e7e3da', paddingBottom: 5, marginBottom: 8,
  },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.6, color: '#35564f' },
  sectionCaption: { fontSize: 8, color: '#999999', letterSpacing: 0.4 },

  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { width: 122, padding: 9, backgroundColor: '#f7f5f1', borderRadius: 4, borderWidth: 1, borderColor: '#e7e3da' },
  cardLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 },
  cardValue: { fontSize: 14, fontWeight: 'bold' },
  cardSub: { fontSize: 6.75, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.75, marginTop: 3 },
  below: { marginTop: 9 },
  belowTwo: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },

  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 },
  chartTitle: { fontSize: 8.25, fontWeight: 'bold' },
  chartSub: { fontSize: 7.5, color: '#999999', marginTop: 2 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 300 },
  key: { flexDirection: 'row', alignItems: 'center', marginLeft: 9, marginBottom: 2 },
  keySwatch: { width: 7, height: 7, borderRadius: 1.5, marginRight: 4 },
  keyText: { fontSize: 7.5, color: '#666666' },
  empty: { fontSize: 8, color: '#999999', paddingVertical: 20, textAlign: 'center' },

  table: { borderWidth: 1, borderColor: '#e7e3da', borderRightWidth: 0, borderBottomWidth: 0 },
  row: { flexDirection: 'row' },
  cell: { borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#e7e3da', paddingVertical: 2.4, paddingHorizontal: 6, fontSize: 8 },
  headCell: { backgroundColor: '#f1efe9', fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.6, paddingVertical: 4.5 },

  footer: {
    position: 'absolute', bottom: 30, left: 40, right: 40, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e7e3da',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: '#999999', textTransform: 'uppercase', letterSpacing: 1.4 },
});

export const num = (v: any) => Number(v || 0);
export const fmtCurrency = (v: any) => `£${num(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPercent = (v: any) => `${num(v).toFixed(1)}%`;
export const fmtHours = (h: number) => `${h.toFixed(1)}h`;
export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m` : `${Math.round(m)}m`);
export const isNil = (v: any) => v === null || v === undefined;
export const CHART_W = 515;

export const Metric = ({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={[styles.cardValue, muted ? { color: '#999999' } : {}]}>{value}</Text>
    {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
  </View>
);

export const Section = ({ label, caption, children }: { label: string; caption?: string; children: React.ReactNode }) => (
  <View style={styles.section} wrap={false}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
    {children}
  </View>
);

export const ChartHead = ({ title, sub, keys }: { title: string; sub?: string; keys?: { label: string; color: string }[] }) => (
  <View style={styles.chartTop}>
    <View>
      <Text style={styles.chartTitle}>{title}</Text>
      {sub ? <Text style={styles.chartSub}>{sub}</Text> : null}
    </View>
    {keys ? (
      <View style={styles.keys}>
        {keys.map((k) => (
          <View key={k.label} style={styles.key}>
            <View style={[styles.keySwatch, { backgroundColor: k.color }]} />
            <Text style={styles.keyText}>{k.label}</Text>
          </View>
        ))}
      </View>
    ) : null}
  </View>
);
