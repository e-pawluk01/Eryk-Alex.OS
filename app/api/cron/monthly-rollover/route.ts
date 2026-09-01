import { NextResponse } from 'next/server';
// Cron runs server-side with no user session, so it uses the service-role
// client to get past RLS on analytics_monthly_snapshots.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getMonthlyAnalytics, createNextMonthTab } from '@/lib/sheets';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { generateMonthlyReportBuffer } from '@/lib/pdf';
import { sendMonthlyReportEmail, sendErrorAlertEmail } from '@/lib/email';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const prevDate = subMonths(now, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const currentMonthName = now.toLocaleString("en-US", { month: "short" }) + " " + now.getFullYear().toString().slice(2);
  
  const results = {
    phaseA: "pending",
    phaseB: "pending"
  };

  // ==========================================
  // PHASE A: CLOSE PREVIOUS MONTH & SEND PDF
  // ==========================================
  try {
    const { data: snapshot } = await supabase
      .from("analytics_monthly_snapshots")
      .select("*")
      .eq("month", prevMonthKey)
      .maybeSingle();

    let finalSnapshot = snapshot;

    // 1. Generate & Insert Snapshot if missing
    if (!finalSnapshot) {
      console.log(`[Phase A] No snapshot found for ${prevMonthKey}. Generating...`);
      
      const [sheetsResult, prevHours] = await Promise.all([
        getMonthlyAnalytics(prevDate.toISOString()),
        fetchCurrentMonthHours(prevDate)
      ]);

      if (sheetsResult.error || !sheetsResult.data) {
        throw new Error(`Failed to fetch Google Sheets data for previous month: ${sheetsResult.error}`);
      }

      const prevSheets = sheetsResult.data;
      const profitPerHour = prevHours > 0 ? prevSheets.grossProfit / prevHours : 0;

      const payload = {
        month: prevMonthKey,
        month_label: prevSheets.monthLabel,
        revenue: prevSheets.revenue,
        cogs: prevSheets.cogs,
        gross_profit: prevSheets.grossProfit,
        gross_margin: prevSheets.grossMargin,
        items_sold: prevSheets.itemsSold,
        average_sale_price: prevSheets.avgSalePrice,
        average_profit_per_item: prevSheets.avgProfitPerItem,
        total_hours: prevHours,
        profit_per_hour: profitPerHour,
        sales_details: prevSheets.salesTable
      };

      const { data: newSnapshot, error: insertError } = await supabase
        .from("analytics_monthly_snapshots")
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;
      finalSnapshot = newSnapshot;
    }

    // 2. Generate PDF and Email if not yet emailed
    if (finalSnapshot && !finalSnapshot.pdf_emailed_at) {
      console.log(`[Phase A] Generating and emailing PDF for ${finalSnapshot.month_label}...`);
      
      const pdfBuffer = await generateMonthlyReportBuffer(finalSnapshot);
      const emailResult = await sendMonthlyReportEmail(finalSnapshot.month_label, pdfBuffer);
      
      if (emailResult.error) {
        throw new Error(`Email delivery failed: ${JSON.stringify(emailResult.error)}`);
      }

      // Mark as emailed
      const { error: updateError } = await supabase
        .from("analytics_monthly_snapshots")
        .update({ pdf_emailed_at: new Date().toISOString() })
        .eq("id", finalSnapshot.id);

      if (updateError) throw updateError;
      console.log(`[Phase A] Successfully emailed and locked snapshot.`);
      results.phaseA = "success";
    } else {
      console.log(`[Phase A] Snapshot already closed and emailed. Skipping.`);
      results.phaseA = "skipped";
    }

  } catch (error: any) {
    console.error("[Phase A Error]", error);
    results.phaseA = `failed: ${error.message}`;
    await sendErrorAlertEmail("Phase A (Report Generation)", error.message || String(error));
  }

  // ==========================================
  // PHASE B: CREATE NEW MONTH TAB
  // ==========================================
  try {
    console.log(`[Phase B] Attempting to create new tab: ${currentMonthName}`);
    const creationResult = await createNextMonthTab(currentMonthName);
    
    if (creationResult.error) {
      throw new Error(creationResult.error);
    }
    
    if (creationResult.skipped) {
      results.phaseB = "skipped";
    } else {
      results.phaseB = "success";
    }
  } catch (error: any) {
    console.error("[Phase B Error]", error);
    results.phaseB = `failed: ${error.message}`;
    await sendErrorAlertEmail("Phase B (Tab Creation)", error.message || String(error));
  }

  return NextResponse.json({
    status: "done",
    results
  });
}

// Helper function
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
