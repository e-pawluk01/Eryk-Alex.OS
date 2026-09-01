import { NextResponse } from 'next/server';
import { carryForwardUnsold } from '@/lib/carry-forward';

// Manual trigger for the unsold-stock carry-forward.
//   /api/carry-forward?from=Aug%2026&to=Sep%2026&key=<CRON_SECRET>
// Use it to test against duplicate tabs, and to populate the current month
// once. The monthly cron calls the same logic automatically from October on.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const authHeader = request.headers.get('authorization');
  const key = searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${secret}` && key !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return new NextResponse('Pass ?from=<tab>&to=<tab>', { status: 400 });
  }

  try {
    const result = await carryForwardUnsold(from, to);
    const status = 'error' in result ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (error: any) {
    console.error('Carry-forward error:', error);
    return new NextResponse(`Carry-forward failed: ${error.message}`, { status: 500 });
  }
}
