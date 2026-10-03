import { NextResponse } from 'next/server';
import { runMonthlyTake } from '@/lib/monthly-take';
import { sendErrorAlertEmail } from '@/lib/email';

// Claude can take a while to write, and may need a second go.
export const maxDuration = 300;

// Claude's monthly take by hand: ?key=<CRON_SECRET>&month=2026-09 sends it
// (once per month; add &force=1 to send again). Add &preview=1 to see it
// without sending. Each run asks Claude afresh, so a preview costs about $0.08.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}` && searchParams.get('key') !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Add ?month=yyyy-MM, e.g. month=2026-09' }, { status: 400 });
  }

  const preview = !!searchParams.get('preview');
  try {
    const result = await runMonthlyTake(month, { send: !preview, force: !!searchParams.get('force') });
    if (result.skipped) return NextResponse.json({ sent: false, reason: `Already sent for ${month}. Add &force=1 to send again.` });
    if (preview) return new NextResponse(result.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    return NextResponse.json({ sent: true, attempts: result.attempts, numberCheck: result.failure ? 'failed: sent without the written parts' : 'passed', saveError: result.saveError });
  } catch (error: any) {
    console.error('Monthly take failed:', error);
    if (!preview) await sendErrorAlertEmail("Claude's monthly take", error?.message || String(error));
    return NextResponse.json({ error: error?.message || 'Monthly take failed' }, { status: 500 });
  }
}
