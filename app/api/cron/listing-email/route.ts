import { NextResponse } from 'next/server';
import { readLadderItems } from '@/lib/ladder-sheet';
import { schedule, todaysList } from '@/lib/listing-ladder';
import { listingEmailHtml } from '@/lib/listing-email-html';
import { buildReportExtras } from '@/lib/report-extras';
import { readLabDecisionsDue } from '@/lib/lab-sheet';
import { sendListingEmail, sendErrorAlertEmail } from '@/lib/email';

const STARTING_DAYS_TO_SELL = 28;

// Runs every night (vercel.json). Works out which listings are due and emails
// them; nothing due, no email. Also opens in a browser with ?key=<CRON_SECRET>
// (add &preview=1 to see today's email without sending it).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}` && searchParams.get('key') !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // yyyy-MM-dd
    const [items, extras] = await Promise.all([readLadderItems(now), buildReportExtras(now)]);

    // Each category's timing blends from the starting 28 days towards its own
    // days to sell, by the same trust as the Categories section, once half of
    // its items have sold.
    const own = new Map((extras?.ranking.categories ?? [])
      .filter((c) => c.daysReached && c.days !== null && c.name !== 'Other')
      .map((c) => [c.name, { days: c.days!, trust: c.trust }]));
    const daysToSellOf = (category: string) => {
      const c = own.get(category);
      return c ? c.trust * c.days + (1 - c.trust) * STARTING_DAYS_TO_SELL : STARTING_DAYS_TO_SELL;
    };
    const names = [...own.keys()];
    const timingsLine = names.length
      ? `Timings: ${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} partly use your own data · everything else on starting weeks`
      : 'Timings: every category on starting weeks so far';

    const list = todaysList(schedule(items, daysToSellOf, todayKey));
    const count = list.refreshes.length + list.checkins.length;
    // A Lab sheet problem never stops the listings email.
    const lab = await readLabDecisionsDue(todayKey).catch((err) => { console.error('Lab sheet read failed:', err); return []; });
    const dateLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
    const html = listingEmailHtml({ ...list, timingsLine, dateLabel, lab });

    if (searchParams.get('preview')) return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (count === 0 && lab.length === 0) return NextResponse.json({ sent: false, reason: 'Nothing due today.' });

    const labPart = lab.length ? `${lab.length} lab decision${lab.length === 1 ? '' : 's'} due` : '';
    const subject = count === 0
      ? `${labPart} - ${dateLabel}`
      : `${count} listing${count === 1 ? '' : 's'} to update${labPart ? ` · ${labPart}` : ''} - ${dateLabel}`;
    const result = await sendListingEmail(subject, html);
    if (result.error) throw new Error(`Email delivery failed: ${JSON.stringify(result.error)}`);
    return NextResponse.json({ sent: true, count, lab: lab.length, waiting: list.waiting });
  } catch (error: any) {
    console.error('Listing email failed:', error);
    await sendErrorAlertEmail('Daily listing email', error?.message || String(error));
    return NextResponse.json({ error: error?.message || 'Listing email failed' }, { status: 500 });
  }
}
