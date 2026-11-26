import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { styles, Section, Metric, fmtCurrency } from './pdf-parts';

// The invoice for a kept item: what it cost the business to get it home (its landed cost).
// Same look as the monthly report PDF (lib/pdf-parts.tsx), made to be printed.

export interface InvoiceData {
  code: string;
  name: string;
  category: string | null;
  keptBy: 'Eryk' | 'Alex';
  keptOn: string; // "25 Nov 2026"
  batch: number | null;
  paid: number;
  nonGbpFee: number;
  purchaseFee: number;
  share: number; // its share of shipping, fees and customs
  total: number; // landed cost
  generatedOn: string;
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View style={styles.row}>
    <Text style={[styles.cell, { flex: 1 }, strong ? { fontWeight: 'bold', backgroundColor: '#f7f5f1' } : {}]}>{label}</Text>
    <Text style={[styles.cell, { width: 90, textAlign: 'right' }, strong ? { fontWeight: 'bold', backgroundColor: '#f7f5f1' } : {}]}>{value}</Text>
  </View>
);

export function InvoiceDocument({ d }: { d: InvoiceData }) {
  return (
    <Document title={`Invoice ${d.code}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Invoice</Text>
          <Text style={styles.subtitle}>Kept item · {d.code}</Text>
        </View>

        <Section label="Summary">
          <View style={styles.grid}>
            <Metric label="Kept by" value={d.keptBy} small />
            <Metric label="Date" value={d.keptOn} small />
            <Metric label="Batch" value={d.batch != null ? String(d.batch) : '—'} small />
            <Metric label="Total due" value={fmtCurrency(d.total)} />
          </View>
        </Section>

        <Section label="Item">
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.headCell, { width: 60 }]}>Code</Text>
              <Text style={[styles.cell, styles.headCell, { flex: 1 }]}>Item</Text>
              <Text style={[styles.cell, styles.headCell, { width: 110 }]}>Category</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.cell, { width: 60 }]}>{d.code}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{d.name}</Text>
              <Text style={[styles.cell, { width: 110 }]}>{d.category ?? '—'}</Text>
            </View>
          </View>
        </Section>

        <Section label="Landed cost" caption="What it cost the business to get it home">
          <View style={styles.table}>
            <Row label="Paid" value={fmtCurrency(d.paid)} />
            <Row label="Non-GBP fee" value={fmtCurrency(d.nonGbpFee)} />
            <Row label="Purchase fee" value={fmtCurrency(d.purchaseFee)} />
            <Row label="Share of shipping, fees and customs" value={fmtCurrency(d.share)} />
            <Row label="Total due" value={fmtCurrency(d.total)} strong />
          </View>
        </Section>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {d.generatedOn}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export const generateInvoiceBuffer = (d: InvoiceData) => renderToBuffer(<InvoiceDocument d={d} />);
