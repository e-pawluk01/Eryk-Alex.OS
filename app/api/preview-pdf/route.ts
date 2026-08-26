import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getMonthlyAnalytics } from '@/lib/sheets';
import { startOfMonth, endOfMonth } from 'date-fns';
import { generateMonthlyReportBuffer } from '@/lib/pdf';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month'); // e.g., "2026-08"

  const dateObj = monthParam ? new Date(`${monthParam}-02T00:00:00Z`) : new Date(); // Use 2nd day to avoid timezone underflow
  const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    let payload;

    // 1. Try to fetch an existing snapshot from Supabase
    const { data: snapshot, error: snapshotError } = await supabase
      .from("analytics_monthly_snapshots")
      .select("*")
      .eq("month", monthKey)
      .maybeSingle();

    if (snapshot && !snapshotError) {
      payload = snapshot;
    } else {
      // 2. If no snapshot exists, generate a simulated payload live
      const [sheetsResult, currentHours] = await Promise.all([
        getMonthlyAnalytics(dateObj.toISOString()),
        fetchCurrentMonthHours(dateObj)
      ]);

      if (sheetsResult.error || !sheetsResult.data) {
        return new NextResponse(`Failed to fetch Google Sheets data: ${sheetsResult.error}`, { status: 500 });
      }

      const sheets = sheetsResult.data;
      const profitPerHour = currentHours > 0 ? sheets.grossProfit / currentHours : 0;

      payload = {
        month: monthKey,
        month_label: sheets.monthLabel,
        revenue: sheets.revenue,
        cogs: sheets.cogs,
        gross_profit: sheets.grossProfit,
        gross_margin: sheets.grossMargin,
        items_sold: sheets.itemsSold,
        average_sale_price: sheets.avgSalePrice,
        average_profit_per_item: sheets.avgProfitPerItem,
        total_hours: currentHours,
        profit_per_hour: profitPerHour,
        sales_details: sheets.salesTable || []
      };
    }

    // Generate the PDF exactly as the cron job does
    const pdfBuffer = await generateMonthlyReportBuffer(payload);

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${monthKey}.pdf"`
      }
    });

  } catch (error: any) {
    console.error("Preview Route Error:", error);
    return new NextResponse(`Error generating PDF preview: ${error.message}`, { status: 500 });
  }
}

// Helper function duplicated from cron logic
async function fetchCurrentMonthHours(date: Date): Promise<number> {
  const start = startOfMonth(date).toISOString();
  const end = endOfMonth(date).toISOString();

  const { data: sessions, error } = await supabase
    .from("work_sessions")
    .select("duration")
    .gte("started_at", start)
    .lte("started_at", end)
    .not("ended_at", "is", null);

  if (error) return 0;
  if (!sessions) return 0;
  const totalSeconds = sessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  return totalSeconds / 3600;
}
