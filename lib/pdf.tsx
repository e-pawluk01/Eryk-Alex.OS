import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    color: '#111111',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 30,
    gap: 15,
  },
  metricCard: {
    width: '30%',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  metricTitle: {
    fontSize: 8,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eeeeee',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '20%',
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#f4f4f4',
    padding: 6,
  },
  tableCol: {
    width: '20%',
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#eeeeee',
    padding: 6,
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
  }
});

const MonthlyReportPDF = ({ snapshot }: { snapshot: any }) => {
  const formatCurrency = (val: number) => `£${Number(val || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val: number) => `${Number(val || 0).toFixed(1)}%`;

  const sales = Array.isArray(snapshot.sales_details) ? snapshot.sales_details : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Business Analytics</Text>
          <Text style={styles.subtitle}>{snapshot.month_label} Report</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Revenue</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.revenue)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Gross Profit</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.gross_profit)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>COGS</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.cogs)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Gross Margin</Text>
            <Text style={styles.metricValue}>{formatPercent(snapshot.gross_margin)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Items Sold</Text>
            <Text style={styles.metricValue}>{snapshot.items_sold || 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Avg Sale Price</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.average_sale_price)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Avg Profit/Item</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.average_profit_per_item)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Total Hours</Text>
            <Text style={styles.metricValue}>{Number(snapshot.total_hours || 0).toFixed(1)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Profit / Hour</Text>
            <Text style={styles.metricValue}>{formatCurrency(snapshot.profit_per_hour)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sales Details</Text>
        
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
                <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(item.buy)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(item.sold)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.tts}</Text></View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 10, color: '#666' }}>No items sold this month.</Text>
        )}

      </Page>
    </Document>
  );
};

export async function generateMonthlyReportBuffer(snapshot: any): Promise<Buffer> {
  const buffer = await renderToBuffer(<MonthlyReportPDF snapshot={snapshot} />);
  return buffer;
}
