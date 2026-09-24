import { NextResponse } from 'next/server';
// Gated by CRON_SECRET below; the service-role client sees snapshots and
// sessions past RLS, like the monthly cron does.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getMonthlyAnalytics } from '@/lib/sheets';
import { generateMonthlyReportBuffer } from '@/lib/pdf';
import { fetchSessionsForMonth, buildTimeBreakdown } from '@/lib/time-breakdown';
import { fetchReportHistory } from '@/lib/report-history';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Gate the route: financial data. Accept either the Authorization header
  // (curl / scripts) or a ?key= query param (so it opens in a browser).
  const authHeader = request.headers.get('authorization');
  const key = searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${secret}` && key !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const monthParam = searchParams.get('month'); // e.g., "2026-08"

  const dateObj = monthParam ? new Date(`${monthParam}-02T00:00:00Z`) : new Date(); // Use 2nd day to avoid timezone underflow
  const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    let payload: any;

    // 1. Try to fetch an existing snapshot from Supabase
    const { data: snapshot, error: snapshotError } = await supabase
      .from("analytics_monthly_snapshots")
      .select("*")
      .eq("month", monthKey)
      .maybeSingle();

    if (snapshot && !snapshotError) {
      payload = snapshot;

      // Snapshots created before the inventory columns existed have them null.
      // Backfill from the sheet so historical previews still render in full.
      if (payload.items_in_stock === null || payload.items_in_stock === undefined) {
        const inv = await getMonthlyAnalytics(dateObj.toISOString());
        if (inv.data) {
          payload = {
            ...payload,
            selling_costs: payload.selling_costs ?? inv.data.sellingCosts,
            items_in_stock: inv.data.itemsInStock,
            inventory_cost: inv.data.inventoryCost,
            return_on_cost: inv.data.returnOnCost,
            expected_revenue: inv.data.expectedRevenue,
            expected_profit: inv.data.expectedProfit,
          };
        }
      }
    } else {
      // 2. If no snapshot exists, generate a simulated payload live
      const [sheetsResult, sessions] = await Promise.all([
        getMonthlyAnalytics(dateObj.toISOString()),
        fetchSessionsForMonth(supabase, dateObj)
      ]);
      const currentHours = sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600;

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
        selling_costs: sheets.sellingCosts,
        gross_profit: sheets.grossProfit,
        gross_margin: sheets.grossMargin,
        items_sold: sheets.itemsSold,
        average_sale_price: sheets.avgSalePrice,
        average_profit_per_item: sheets.avgProfitPerItem,
        total_hours: currentHours,
        profit_per_hour: profitPerHour,
        sales_details: sheets.salesTable || [],
        items_in_stock: sheets.itemsInStock,
        inventory_cost: sheets.inventoryCost,
        return_on_cost: sheets.returnOnCost,
        expected_revenue: sheets.expectedRevenue,
        expected_profit: sheets.expectedProfit,
        time_breakdown: buildTimeBreakdown(sessions, dateObj),
      };
    }

    // Generate the PDF exactly as the cron job does
    const history = await fetchReportHistory(supabase, monthKey);
    const pdfBuffer = await generateMonthlyReportBuffer(payload, history);

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
