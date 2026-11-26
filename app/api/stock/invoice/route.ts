import { NextResponse } from 'next/server';
// Server-only: reads the item past RLS with the service role, after checking who's asking.
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateInvoiceBuffer, InvoiceData } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/email';

// A kept item's invoice: a PDF (same look as the monthly report) emailed to whoever kept it.
//   POST { itemId }  with the signed-in user's token → builds the PDF and emails it.
//   GET  ?item=<id>&key=<CRON_SECRET>               → the PDF itself, to look at (no email).

const PEOPLE = { Eryk: 'erykpawluk@gmail.com', Alex: 'alexandra.ap.archive@gmail.com' } as const;
const ALLOWED: string[] = Object.values(PEOPLE);
const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (iso: string | null) =>
  (iso ? new Date(`${iso}T12:00:00`) : new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function invoiceFor(itemId: string): Promise<InvoiceData | { error: string; status: number }> {
  const { data: it, error } = await supabaseAdmin.from('stock_items')
    .select('code, name, status, kept_by, exit_date, item_cost, paid, non_gbp_fee, purchase_fee, batch_id, category_id')
    .eq('id', itemId).maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!it) return { error: 'Item not found', status: 404 };
  if (it.status !== 'kept' || !it.kept_by || it.item_cost == null) return { error: 'Only a kept item with a final cost has an invoice', status: 400 };

  const [batch, category] = await Promise.all([
    it.batch_id ? supabaseAdmin.from('stock_batches').select('number').eq('id', it.batch_id).maybeSingle() : null,
    it.category_id ? supabaseAdmin.from('stock_categories').select('name').eq('id', it.category_id).maybeSingle() : null,
  ]);
  const paid = Number(it.paid ?? 0), fx = Number(it.non_gbp_fee ?? 0), pf = Number(it.purchase_fee ?? 0), total = Number(it.item_cost);
  return {
    code: it.code, name: it.name, category: category?.data?.name ?? null,
    keptBy: it.kept_by, keptOn: day(it.exit_date), batch: batch?.data?.number ?? null,
    paid, nonGbpFee: fx, purchaseFee: pf, share: r2(total - paid - fx - pf), total,
    generatedOn: day(null),
  };
}

export async function POST(request: Request) {
  // Only Eryk or Alex, signed in.
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: user } = await supabaseAdmin.auth.getUser(token);
  if (!user?.user?.email || !ALLOWED.includes(user.user.email)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const { itemId } = await request.json().catch(() => ({}));
  if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });

  const d = await invoiceFor(itemId);
  if ('error' in d) return NextResponse.json({ error: d.error }, { status: d.status });

  try {
    const pdf = await generateInvoiceBuffer(d);
    const to = PEOPLE[d.keptBy];
    const sent = await sendInvoiceEmail(to, d.code, d.name, `£${d.total.toFixed(2)}`, pdf);
    if ('error' in sent && sent.error) return NextResponse.json({ error: String((sent.error as any)?.message ?? sent.error) }, { status: 500 });
    return NextResponse.json({ ok: true, to: d.keptBy });
  } catch (e: any) {
    console.error('Invoice failed:', e);
    return NextResponse.json({ error: e?.message || 'Invoice failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || (searchParams.get('key') !== secret && request.headers.get('authorization') !== `Bearer ${secret}`)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const itemId = searchParams.get('item');
  if (!itemId) return new NextResponse('Missing ?item=', { status: 400 });
  const d = await invoiceFor(itemId);
  if ('error' in d) return new NextResponse(d.error, { status: d.status });
  const pdf = await generateInvoiceBuffer(d);
  return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Invoice_${d.code}.pdf"` } });
}
