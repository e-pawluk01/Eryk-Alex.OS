import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { format, getDaysInMonth } from 'date-fns';
import { PRINT, taskPrint, SplitBar, ColumnChart, HorizontalBars } from './pdf-charts';
import type { TimeBreakdown } from './time-breakdown';
import {
  styles, Metric, Section, ChartHead, num, fmtCurrency, fmtPercent, fmtHours, fmtMinutes, isNil, CHART_W,
} from './pdf-parts';

const PROFIT_BANDS = [
  { label: 'Loss', test: (p: number) => p < 0, color: PRINT.red },
  { label: '£0–10', test: (p: number) => p >= 0 && p < 10, color: PRINT.blue },
  { label: '£10–20', test: (p: number) => p >= 10 && p < 20, color: PRINT.orange },
  { label: '£20–30', test: (p: number) => p >= 20 && p < 30, color: PRINT.aqua },
  { label: '£30–40', test: (p: number) => p >= 30 && p < 40, color: PRINT.yellow },
  { label: '£40–60', test: (p: number) => p >= 40 && p < 60, color: PRINT.magenta },
  { label: '£60+', test: (p: number) => p >= 60, color: PRINT.violet },
];

export interface MonthPoint { label: string; revenue: number; grossProfit: number }

const MonthlyReportPDF = ({ snapshot, history }: { snapshot: any; history: MonthPoint[] }) => {
  const sales: any[] = Array.isArray(snapshot.sales_details) ? snapshot.sales_details : [];
  const time: TimeBreakdown | null = snapshot.time_breakdown ?? null;
  const generatedOn = format(new Date(), 'd MMM yyyy');
  const reportName = `${snapshot.month_label} Report`;
  const monthShort = String(snapshot.month_label ?? '').split(' ')[0];
  const [year, month] = String(snapshot.month ?? '').split('-').map(Number);
  const daysInMonth = year && month ? getDaysInMonth(new Date(year, month - 1, 1)) : 30;

  // Performance: where the revenue went. Older snapshots only have the
  // combined selling costs, so fall back to that as one slice.
  const fees = sales.reduce((a, x) => a + num(x.fees), 0);
  const ship = sales.reduce((a, x) => a + num(x.ship), 0);
  const splitCosts = fees + ship > 0
    ? [{ label: 'Selling fees', value: fees, color: PRINT.yellow }, { label: 'Shipping', value: ship, color: PRINT.magenta }]
    : [{ label: 'Selling costs', value: num(snapshot.selling_costs), color: PRINT.yellow }];

  // Time
  const totalHours = num(snapshot.total_hours);
  const topTask = time?.byTask[0];
  const topTasks = (time?.byTask ?? []).slice(0, 4).map((t) => t.task);
  const weekSeries = [...topTasks, 'Other tasks']
    .map((name) => ({
      name,
      color: name === 'Other tasks' ? PRINT.other : taskPrint(name),
      values: (time?.weeks ?? []).map((w) => Object.entries(w.tasks)
        .filter(([t]) => (name === 'Other tasks' ? !topTasks.includes(t) : t === name))
        .reduce((a, [, h]) => a + h, 0)),
    }))
    .filter((x) => x.values.some((v) => v > 0));

  const trend = [...history, { label: monthShort, revenue: num(snapshot.revenue), grossProfit: num(snapshot.gross_profit) }];
  const bandCounts = PROFIT_BANDS.map((b) => sales.filter((x) => b.test(num(x.profit))).length);
  const sortedSales = [...sales].sort((a, b) => String(b.soldOn ?? '').localeCompare(String(a.soldOn ?? '')));
  const moneyAxis = (v: number) => (v >= 1000 ? `£${v / 1000}k` : `£${v}`);

  const Footer = () => (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Generated {generatedOn}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
  const Running = ({ right }: { right: string }) => (
    <View style={styles.running}>
      <Text style={styles.runningText}>Business Analytics · {reportName}</Text>
      <Text style={styles.runningText}>{right}</Text>
    </View>
  );

  return (
    <Document>
      {/* PAGE 1 — THE NUMBERS */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Business Analytics</Text>
          <Text style={styles.subtitle}>{reportName}</Text>
        </View>

        <Section label="Performance">
          <View style={styles.grid}>
            <Metric label="Revenue" value={fmtCurrency(snapshot.revenue)} />
            <Metric label="Gross Profit" value={fmtCurrency(snapshot.gross_profit)} />
            <Metric label="Gross Margin" value={fmtPercent(snapshot.gross_margin)} />
            <Metric label="Profit / Hour" value={fmtCurrency(snapshot.profit_per_hour)} />
          </View>
          <View style={styles.below}>
            <SplitBar label="Where the revenue went" format={fmtCurrency} items={[
              { label: 'Cost of goods', value: num(snapshot.cogs), color: PRINT.aqua },
              ...splitCosts,
              { label: 'Gross profit', value: num(snapshot.gross_profit), color: PRINT.orange, strong: true },
            ]} />
          </View>
        </Section>

        <Section label="Time">
          <View style={styles.grid}>
            <Metric label="Total Hours" value={fmtHours(totalHours)} />
            <Metric label="Hours / Week" value={fmtHours(totalHours / (daysInMonth / 7))} />
            <Metric label="Hours / Item Sold"
              value={totalHours > 0 && num(snapshot.items_sold) > 0 ? fmtMinutes((totalHours * 60) / num(snapshot.items_sold)) : '—'}
              muted={!(totalHours > 0 && num(snapshot.items_sold) > 0)} />
            <Metric label="Top Task" value={topTask ? topTask.task : '—'} muted={!topTask}
              sub={topTask && totalHours > 0 ? `${fmtHours(topTask.hours)} · ${Math.round((topTask.hours / totalHours) * 100)}% of time` : undefined} />
          </View>
          {(time?.byTask.length ?? 0) > 0 && (
          <View style={styles.belowTwo}>
            <View style={{ width: 290 }}>
              <SplitBar label="Hours by task" format={fmtHours}
                items={(time?.byTask ?? []).map((t) => ({ label: t.task, value: t.hours, color: taskPrint(t.task) }))} />
            </View>
            <View style={{ width: 200 }}>
              <SplitBar label="By person" format={fmtHours} columns={1}
                items={(time?.byPerson ?? []).map((p) => ({ label: p.person, value: p.hours, color: p.person === 'Alex' ? PRINT.orange : PRINT.blue }))} />
            </View>
          </View>
          )}
        </Section>

        <Section label="Unit Economics">
          <View style={styles.grid}>
            <Metric label="Items Sold" value={String(snapshot.items_sold || 0)} />
            <Metric label="Avg Sale Price" value={fmtCurrency(snapshot.average_sale_price)} />
            <Metric label="Avg Profit / Item" value={fmtCurrency(snapshot.average_profit_per_item)} />
            <Metric label="Return on Cost" muted={isNil(snapshot.return_on_cost)}
              value={isNil(snapshot.return_on_cost) ? '—' : fmtPercent(snapshot.return_on_cost)} />
          </View>
        </Section>

        <Section label="Inventory" caption="Position at month close">
          <View style={styles.grid}>
            <Metric label="Items in Stock" value={String(snapshot.items_in_stock ?? 0)} />
            <Metric label="Inventory Cost" value={fmtCurrency(snapshot.inventory_cost)} />
            <Metric label="Expected Revenue" muted={isNil(snapshot.expected_revenue)}
              value={isNil(snapshot.expected_revenue) ? '—' : fmtCurrency(snapshot.expected_revenue)} />
            <Metric label="Expected Profit" muted={isNil(snapshot.expected_profit)}
              value={isNil(snapshot.expected_profit) ? '—' : fmtCurrency(snapshot.expected_profit)} />
          </View>
        </Section>
        <Footer />
      </Page>

      {/* PAGE 2 — THE CHARTS */}
      <Page size="A4" style={styles.page}>
        <Running right="Charts" />
        <Section label="Performance">
          <ChartHead title={`Revenue and gross profit, last ${trend.length} month${trend.length === 1 ? '' : 's'}`}
            keys={[{ label: 'Revenue', color: PRINT.blue }, { label: 'Gross profit', color: PRINT.orange }]} />
          <ColumnChart width={CHART_W} height={118} axis={moneyAxis} categories={trend.map((t) => t.label)} series={[
            { color: PRINT.blue, values: trend.map((t) => t.revenue) },
            { color: PRINT.orange, values: trend.map((t) => t.grossProfit) },
          ]} />
        </Section>

        <Section label="Time">
          <ChartHead title="Hours per week, by task"
            sub={weekSeries.some((x) => x.name === 'Other tasks') ? 'Top 4 tasks shown, the rest grouped' : undefined}
            keys={weekSeries.map((x) => ({ label: x.name, color: x.color }))} />
          {weekSeries.length === 0 ? <Text style={styles.empty}>No hours logged this month.</Text> : (
            <ColumnChart width={CHART_W} height={118} stacked axis={(v) => `${v}h`}
              categories={(time?.weeks ?? []).map((w) => `${w.start}–${w.end} ${monthShort}`)}
              series={weekSeries.map((x) => ({ color: x.color, values: x.values }))} />
          )}
        </Section>

        <Section label="Unit Economics">
          <ChartHead title="Sales by profit per item" sub={`${sales.length} item${sales.length === 1 ? '' : 's'} sold`} />
          {sales.length === 0 ? <Text style={styles.empty}>No items sold this month.</Text> : (
            <ColumnChart width={CHART_W} height={118} axis={(v) => String(v)} categories={PROFIT_BANDS.map((b) => b.label)}
              series={[{ color: PROFIT_BANDS.map((b) => b.color), values: bandCounts }]} />
          )}
        </Section>

        <Section label="Inventory" caption="Position at month close">
          <ChartHead title="Money in stock" sub={`${snapshot.items_in_stock ?? 0} items`} />
          <HorizontalBars width={CHART_W} format={(v) => `£${Math.round(v).toLocaleString('en-GB')}`} rows={[
            { label: 'Inventory cost', value: num(snapshot.inventory_cost), color: PRINT.orange },
            ...(isNil(snapshot.expected_revenue) ? [] : [{ label: 'Expected revenue', value: num(snapshot.expected_revenue), color: PRINT.blue }]),
            ...(isNil(snapshot.expected_profit) ? [] : [{ label: 'Expected profit', value: num(snapshot.expected_profit), color: PRINT.aqua }]),
          ]} />
        </Section>
        <Footer />
      </Page>

      {/* PAGE 3+ — SALES DETAIL (flows onto more pages in a busy month) */}
      <Page size="A4" style={styles.page}>
        <Running right="Sales Detail" />
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>Sales Detail</Text>
          <Text style={styles.sectionCaption}>{sales.length} item{sales.length === 1 ? '' : 's'} · newest first</Text>
        </View>
        {sales.length === 0 ? <Text style={{ fontSize: 9, color: '#666666' }}>No items sold this month.</Text> : (
          <View style={styles.table}>
            <View style={styles.row} fixed>
              {[['SKU', 20], ['Sold', 16], ['Paid', 16], ['Sold for', 16], ['Profit', 16], ['Days', 16]].map(([h, w], i) => (
                <Text key={h} style={[styles.cell, styles.headCell, { width: `${w}%`, textAlign: i > 1 ? 'right' : 'left' }]}>{h}</Text>
              ))}
            </View>
            {sortedSales.map((x, i) => (
              <View style={styles.row} key={i} wrap={false}>
                <Text style={[styles.cell, { width: '20%' }]}>{x.sku}</Text>
                <Text style={[styles.cell, { width: '16%' }]}>
                  {x.soldOn ? format(new Date(`${x.soldOn}T12:00`), 'd MMM') : '—'}
                </Text>
                <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>{fmtCurrency(x.buy)}</Text>
                <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>{fmtCurrency(x.sold)}</Text>
                <Text style={[styles.cell, { width: '16%', textAlign: 'right' }, num(x.profit) < 0 ? { color: '#c63b3a' } : {}]}>
                  {num(x.profit) < 0 ? `-${fmtCurrency(Math.abs(num(x.profit)))}` : fmtCurrency(x.profit)}
                </Text>
                <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>{String(x.tts ?? '')}</Text>
              </View>
            ))}
          </View>
        )}
        <Footer />
      </Page>
    </Document>
  );
};

export async function generateMonthlyReportBuffer(snapshot: any, history: MonthPoint[] = []): Promise<Buffer> {
  const buffer = await renderToBuffer(<MonthlyReportPDF snapshot={snapshot} history={history} />);
  return buffer;
}
