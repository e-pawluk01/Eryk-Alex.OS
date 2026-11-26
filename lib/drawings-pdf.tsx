import React from 'react';
import fs from 'fs';
import path from 'path';
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { styles, Metric, Section, fmtCurrency } from './pdf-parts';

// A Partner Drawings Statement: the formal record of money the partners take
// out of the partnership. One statement can list several payments (both
// partners on the same day now; a whole month later). Same look as the monthly
// report. Drawings are an advance against each partner's profit share; they are
// not salary and not taxed in themselves, so the statement never shows tax or
// NI deducted.

export const PARTNERSHIP = {
  name: 'idea. Studio',
  address: ['5 Julian Close', 'Coventry', 'CV2 2NN'],
  kind: 'General partnership (Partnership Act 1890)',
  partners: ['Eryk Pawluk', 'Alexandra Trenčianska'] as const,
  profitShare: '50% / 50% (written partnership agreement)',
  yearEnd: '5 April (accounting year matches the UK tax year)',
};

export type Partner = (typeof PARTNERSHIP.partners)[number];

export type DrawingType =
  | 'Drawing on account of profits'
  | 'Distribution of finalised profits'
  | 'Withdrawal of capital'
  | 'Reimbursement of expenses';

export interface DrawingPayment {
  partner: Partner;
  date: string;                 // ISO date paid, e.g. "2026-11-23"
  amount: number;               // GBP
  type: DrawingType;
  method: string;               // e.g. "Bank transfer"
  bankReference: string;        // what the bank statement line shows
}

export interface DrawingStatement {
  reference: string;            // e.g. "DRW-2026-001", sequential, never reused
  taxYear: string;              // e.g. "2026-27" (6 April – 5 April)
  payments: DrawingPayment[];
  // Each partner's current account (profit share credited less drawn) before
  // this statement's payments.
  openingBalance: Record<Partner, number>;
  // Drawn so far this tax year, BEFORE this statement's payments.
  drawnYtd: Record<Partner, number>;
  notes?: string;
  // ISO date each partner signed on, printed on their Date line. Leave a
  // partner out and their line stays blank to write or type by hand.
  signedOn?: Partial<Record<Partner, string>>;
  draft?: boolean;              // prints a DRAFT marker
}

// PDF's built-in Helvetica only covers Western European letters, so the "č" in
// Trenčianska would vanish. Embed a TTF that has it: STATEMENT_FONT_DIR (holding
// Regular.ttf + Bold.ttf), else the Arial that ships with macOS. Before this runs
// on a server, commit an open-licence font (e.g. Arimo) and point the env at it.
const FONT_CANDIDATES = [
  process.env.STATEMENT_FONT_DIR && [path.join(process.env.STATEMENT_FONT_DIR, 'Regular.ttf'), path.join(process.env.STATEMENT_FONT_DIR, 'Bold.ttf')],
  ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'],
].filter(Boolean) as [string, string][];

function statementFont(): string {
  const found = FONT_CANDIDATES.find((pair) => pair.every((f) => fs.existsSync(f)));
  if (!found) throw new Error('No font with Latin Extended glyphs found for the drawings statement (set STATEMENT_FONT_DIR).');
  Font.register({ family: 'StatementSans', fonts: [{ src: found[0] }, { src: found[1], fontWeight: 'bold' }] });
  return 'StatementSans';
}

const s = StyleSheet.create({
  partyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  partyLabel: { fontSize: 7, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 },
  partyText: { fontSize: 9, lineHeight: 1.45 },
  partyStrong: { fontSize: 10, fontWeight: 'bold', marginBottom: 1 },
  kvKey: { width: '34%', color: '#666666' },
  kvVal: { width: '66%' },
  note: { fontSize: 8, color: '#444444', lineHeight: 1.5, marginBottom: 3 },
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sigBox: { width: 245 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: '#111111', height: 34, marginBottom: 5 },
  sigText: { fontSize: 8, color: '#444444', marginBottom: 2 },
  draft: {
    position: 'absolute', top: 40, right: 40, fontSize: 9, fontWeight: 'bold', color: '#e34948',
    borderWidth: 1, borderColor: '#e34948', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, letterSpacing: 1.5,
  },
});

// Debit balances (partner has drawn ahead of profit credited) print in brackets.
const fmtBalance = (v: number) => (v < 0 ? `(${fmtCurrency(-v)})` : fmtCurrency(v));
const fmtDate = (iso: string) => format(new Date(`${iso}T12:00:00`), 'd MMM yyyy');

const Rows = ({ rows }: { rows: [string, string][] }) => (
  <View style={styles.table}>
    {rows.map(([k, v]) => (
      <View style={styles.row} key={k} wrap={false}>
        <Text style={[styles.cell, s.kvKey]}>{k}</Text>
        <Text style={[styles.cell, s.kvVal]}>{v}</Text>
      </View>
    ))}
  </View>
);

// Columns as [header, width %, right-aligned?]; rows as cell strings.
const Table = ({ cols, rows, boldLast }: { cols: [string, number, boolean?][]; rows: string[][]; boldLast?: boolean }) => (
  <View style={styles.table}>
    <View style={styles.row}>
      {cols.map(([h, w, right]) => (
        <Text key={h} style={[styles.cell, styles.headCell, { width: `${w}%`, textAlign: right ? 'right' : 'left' }]}>{h}</Text>
      ))}
    </View>
    {rows.map((r, i) => (
      <View style={styles.row} key={i} wrap={false}>
        {r.map((v, j) => (
          <Text key={j} style={[styles.cell, { width: `${cols[j][1]}%`, textAlign: cols[j][2] ? 'right' : 'left' },
            boldLast && i === rows.length - 1 ? { fontWeight: 'bold' } : {}]}>{v}</Text>
        ))}
      </View>
    ))}
  </View>
);

const DrawingStatementPDF = ({ d, fontFamily }: { d: DrawingStatement; fontFamily: string }) => {
  const partners = PARTNERSHIP.partners;
  const total = d.payments.reduce((a, p) => a + p.amount, 0);
  const drawnNow = (p: Partner) => d.payments.filter((x) => x.partner === p).reduce((a, x) => a + x.amount, 0);
  const dates = [...new Set(d.payments.map((p) => p.date))].sort();
  const dateLabel = dates.length === 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;
  const plural = d.payments.length > 1;
  const types = [...new Set(d.payments.map((p) => p.type.toLowerCase()))]
    .map((t) => (plural ? t.replace(/^(\w+)/, (w) => (w.endsWith('s') ? w : `${w}s`)) : t));
  const paidTo = partners.filter((p) => drawnNow(p) > 0);

  return (
    <Document title={`${d.reference} · Partner Drawings Statement`} author={PARTNERSHIP.name}>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        {d.draft ? <Text style={s.draft}>DRAFT</Text> : null}
        <View style={styles.header}>
          <Text style={styles.title}>Partner Drawings Statement</Text>
          <Text style={styles.subtitle}>{PARTNERSHIP.name} · {d.reference}</Text>
        </View>

        <View style={s.partyRow}>
          <View>
            <Text style={s.partyLabel}>Partnership</Text>
            <Text style={s.partyStrong}>{PARTNERSHIP.name}</Text>
            {PARTNERSHIP.address.map((l) => <Text key={l} style={s.partyText}>{l}</Text>)}
            <Text style={[s.partyText, { color: '#666666' }]}>{PARTNERSHIP.kind}</Text>
          </View>
          <View style={{ width: 200 }}>
            <Text style={s.partyLabel}>Paid to</Text>
            {paidTo.map((p) => <Text key={p} style={s.partyStrong}>{p}</Text>)}
            <Text style={s.partyText}>Partners</Text>
            <Text style={[s.partyText, { color: '#666666' }]}>Profit share {PARTNERSHIP.profitShare.split(' (')[0]}</Text>
          </View>
        </View>

        <Section label="Payments">
          <View style={styles.grid}>
            <Metric label="Total Paid" value={fmtCurrency(total)} />
            <Metric label="Date Paid" value={dateLabel} small />
            <Metric label="Tax Year" value={d.taxYear} small />
            <Metric label="Reference" value={d.reference} small />
          </View>
          <View style={styles.below}>
            <Table
              cols={[['Partner', 26], ['Date', 14], ['Method', 16], ['Bank reference', 26], ['Amount', 18, true]]}
              rows={[
                ...d.payments.map((p) => [p.partner, fmtDate(p.date), p.method, p.bankReference, fmtCurrency(p.amount)]),
                ['Total', '', '', '', fmtCurrency(total)],
              ]}
              boldLast
            />
          </View>
          <View style={styles.below}>
            <Rows rows={[
              ['Type', [...new Set(d.payments.map((p) => p.type))].join('; ')],
              ['Profit-sharing ratio', PARTNERSHIP.profitShare],
              ['Accounting year end', PARTNERSHIP.yearEnd],
              ['Tax or NI deducted', 'None. Not a salary; partners are taxed on their profit share through Self Assessment.'],
              ['VAT', 'Outside the scope of VAT (cash drawings)'],
            ]} />
          </View>
        </Section>

        <Section label="Current Accounts" caption={`Tax year ${d.taxYear}`}>
          <Table
            cols={[['Partner', 28], ['Balance before', 18, true], ['Drawn now', 18, true], ['Balance after', 18, true], ['Drawn this year', 18, true]]}
            rows={partners.map((p) => [
              p,
              fmtBalance(d.openingBalance[p]),
              drawnNow(p) ? `(${fmtCurrency(drawnNow(p))})` : '—',
              fmtBalance(d.openingBalance[p] - drawnNow(p)),
              fmtCurrency(d.drawnYtd[p] + drawnNow(p)),
            ])}
          />
          <Text style={[styles.chartSub, { marginTop: 4 }]}>
            Profit share is credited to each current account when the year's accounts are finalised. Figures in brackets are drawn ahead of profit credited.
          </Text>
        </Section>

        {d.notes ? (
          <Section label="Notes">
            <Text style={s.note}>{d.notes}</Text>
          </Section>
        ) : null}

        <Section label="Authorisation">
          <Text style={s.note}>
            We confirm the payments above were made from partnership funds to the partners named, as {types.join(' and ')}, under the partnership agreement.
          </Text>
          <View style={s.sigRow}>
            {partners.map((p) => (
              <View key={p} style={s.sigBox}>
                <View style={s.sigLine} />
                <Text style={s.sigText}>{p}, Partner</Text>
                <Text style={s.sigText}>Date: {d.signedOn?.[p] ? fmtDate(d.signedOn[p]!) : ''}</Text>
              </View>
            ))}
          </View>
        </Section>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{PARTNERSHIP.name} · {d.reference}</Text>
          <Text style={styles.footerText}>Generated {format(new Date(), 'd MMM yyyy')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export async function generateDrawingStatementBuffer(d: DrawingStatement) {
  return renderToBuffer(<DrawingStatementPDF d={d} fontFamily={statementFont()} />);
}
