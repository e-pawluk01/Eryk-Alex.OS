import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rolloverTasks } from '@/lib/task-rollover';
import { sendErrorAlertEmail } from '@/lib/email';

// Runs every night (vercel.json): unticked tasks from past days move to today,
// ticked ones are deleted. The app also does this itself when opened and at
// midnight, so this is the catch-up for when nobody has it open.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (request.headers.get('authorization') !== `Bearer ${secret}` && searchParams.get('key') !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    return NextResponse.json(await rolloverTasks(supabaseAdmin));
  } catch (error: any) {
    console.error('Task rollover failed:', error);
    await sendErrorAlertEmail('Task rollover', error?.message || String(error));
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
