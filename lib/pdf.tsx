import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica', color: '#111111' },

  header: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#cfc9bd', paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 11, color: '#666666', textTransform: 'uppercase', letterSpacing: 2 },

  section: { marginBottom: 18 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#e7e3da', paddingBottom: 5, marginBottom: 10,
  },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.6, color: '#35564f' },
  sectionCaption: { fontSize: 8, color: '#999999', letterSpacing: 0.4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '31.8%', padding: 10, backgroundColor: '#f7f5f1', borderRadius: 4, borderWidth: 1, borderColor: '#e7e3da' },
  cardLabel: { fontSize: 8, color: '#666666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  cardValue: { fontSize: 14, fontWeight: 'bold' },
  cardValueMuted: { fontSize: 14, fontWeight: 'bold', color: '#999999' },

  salesTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginTop: 14 },
  table: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#e7e3da', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { flexDirection: 'row' },
  tableColHeader: { width: '20%', borderStyle: 'solid', borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#e7e3da', backgroundColor: '#f1efe9', padding: 6 },
  tableCol: { width: '20%', borderStyle: 'solid', borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#e7e3da', padding: 6 },
  tableCellHeader: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  tableCell: { fontSize: 9 },

  footer: { marginTop: 22, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e7e3da', flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#999999', textTransform: 'uppercase', letterSpacing: 1.4 },
});

const fmtCurrency = (val: any) =>
  `£${Number(val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPercent = (val: any) => `${Number(val || 0).toFixed(1)}%`;
const isNil = (v: any) => v === null || v === undefined;

const Metric = ({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={muted ? styles.cardValueMuted : styles.cardValue}>{value}</Text>
  </View>
);

const Section = ({ label, caption, children }: { label: string; caption?: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
    <View style={styles.grid}>{children}</View>
  </View>
);

const MonthlyReportPDF = ({ snapshot }: { snapshot: any }) => {
  const sales = Array.isArray(snapshot.sales_details) ? snapshot.sales_details : [];
  const generatedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Business Analytics</Text>
          <Text style={styles.subtitle}>{snapshot.month_label} Report</Text>
        </View>

        <Section label="Performance">
          <Metric label="Revenue" value={fmtCurrency(snapshot.revenue)} />
          <Metric label="COGS" value={fmtCurrency(snapshot.cogs)} />
          <Metric label="Selling Costs" value={fmtCurrency(snapshot.selling_costs)} />
          <Metric label="Gross Profit" value={fmtCurrency(snapshot.gross_profit)} />
          <Metric label="Gross Margin" value={fmtPercent(snapshot.gross_margin)} />
          <Metric label="Profit / Hour" value={fmtCurrency(snapshot.profit_per_hour)} />
          <Metric label="Total Hours" value={Number(snapshot.total_hours || 0).toFixed(1)} />
        </Section>

        <Section label="Unit Economics">
          <Metric label="Items Sold" value={String(snapshot.items_sold || 0)} />
          <Metric label="Avg Sale Price" value={fmtCurrency(snapshot.average_sale_price)} />
          <Metric label="Avg Profit / Item" value={fmtCurrency(snapshot.average_profit_per_item)} />
          <Metric
            label="Return on Cost"
            value={isNil(snapshot.return_on_cost) ? '—' : fmtPercent(snapshot.return_on_cost)}
            muted={isNil(snapshot.return_on_cost)}
          />
        </Section>

        <Section label="Inventory" caption="Position at month close">
          <Metric label="Items in Stock" value={String(snapshot.items_in_stock ?? 0)} />
          <Metric label="Inventory Cost" value={fmtCurrency(snapshot.inventory_cost)} />
          <Metric
            label="Expected Revenue"
            value={isNil(snapshot.expected_revenue) ? '—' : fmtCurrency(snapshot.expected_revenue)}
            muted={isNil(snapshot.expected_revenue)}
          />
          <Metric
            label="Expected Profit"
            value={isNil(snapshot.expected_profit) ? '—' : fmtCurrency(snapshot.expected_profit)}
            muted={isNil(snapshot.expected_profit)}
          />
        </Section>

        <Text style={styles.salesTitle}>Sales Detail</Text>
        {sales.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>SKU</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Buy</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Sold</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Profit</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>TTS</Text></View>
            </View>

            {sales.map((item: any, i: number) => (
              <View style={styles.tableRow} key={i}>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.sku}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtCurrency(item.buy)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtCurrency(item.sold)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{fmtCurrency(item.profit)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.tts}</Text></View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 10, color: '#666' }}>No items sold this month.</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated {generatedOn}</Text>
          <Text style={styles.footerText}>Task OS · Monthly Rollover</Text>
        </View>
      </Page>
    </Document>
  );
};

export async function generateMonthlyReportBuffer(snapshot: any): Promise<Buffer> {
  const buffer = await renderToBuffer(<MonthlyReportPDF snapshot={snapshot} />);
  return buffer;
}
