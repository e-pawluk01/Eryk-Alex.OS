"use server";

import { google } from "googleapis";
import { unstable_cache } from "next/cache";

function getGoogleSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  return google.sheets({ version: "v4", auth: oauth2Client });
}

// 1. Heavy Cache: Resolve the actual tab name (e.g. "Aug 26") for the current month
// Caches for 24 hours, but automatically invalidates on month rollover due to the dynamic key.
const getResolvedTabName = unstable_cache(
  async (spreadsheetId: string, currentMonthString: string, currentMonthKey: string) => {
    const sheets = getGoogleSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    
    // Normalize target (e.g., "Aug 26" -> "aug26")
    const targetNormalized = currentMonthString.replace(/\s+/g, "").toLowerCase();

    const matchedTab = spreadsheet.data.sheets?.find(
      (s: any) => s.properties?.title?.replace(/\s+/g, "").toLowerCase() === targetNormalized
    );

    return matchedTab?.properties?.title || null;
  },
  ["sheets-tab-name"], // Next.js appends arguments to this base key array automatically.
  { revalidate: 86400 } // 24 hours
);

// 2. Light Cache: Fetch the actual data from the resolved tab
// Caches for 5 minutes.
const getTabData = unstable_cache(
  async (spreadsheetId: string, tabName: string, currentMonthKey: string) => {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A:F`,
    });
    return response.data.values || [];
  },
  ["sheets-tab-data"], 
  { revalidate: 300 } // 5 minutes
);

export async function getMonthlyAnalytics() {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    return { error: "Google Sheets integration is missing environment variables." };
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const date = new Date();
    // E.g., "Aug 26"
    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear().toString().slice(2);
    const targetTabString = `${month} ${year}`;
    
    // Create the YYYY-MM key for perfect month-boundary cache invalidation
    const currentMonthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    // 1. Resolve Tab (Cached 24h, keyed by YYYY-MM indirectly via currentMonthKey if we passed it, but targetTabString naturally changes)
    // Actually, passing targetTabString ("Aug 26") effectively works, but to guarantee it doesn't drift, we pass currentMonthKey.
    // We didn't add currentMonthKey to getResolvedTabName args, but targetTabString ("Aug 26") acts as the boundary key. 
    // Just to be explicitly compliant with the senior advisor's note, we pass currentMonthKey to ensure the cache strictly misses.
    
    const tabName = await getResolvedTabName(spreadsheetId, targetTabString, currentMonthKey);
    
    if (!tabName) {
      return { error: `No sheet tab found matching '${targetTabString}'.` };
    }

    // 2. Fetch Data (Cached 5m, strictly keyed by YYYY-MM to prevent stale data)
    const rows = await getTabData(spreadsheetId, tabName, currentMonthKey);

    // Calculate metrics
    let revenue = 0;
    let cogs = 0;
    let itemsSold = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const spStr = row[1] || "";
      const sfStr = row[2] || "";
      
      const sfValue = parseFloat(sfStr.replace(/[^0-9.-]+/g, "")) || 0;
      const spValue = parseFloat(spStr.replace(/[^0-9.-]+/g, "")) || 0;

      if (sfValue > 0) {
        revenue += sfValue;
        cogs += spValue;
        itemsSold++;
      }
    }

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const avgSalePrice = itemsSold > 0 ? revenue / itemsSold : 0;
    const avgProfitPerItem = itemsSold > 0 ? grossProfit / itemsSold : 0;

    return {
      data: {
        revenue,
        cogs,
        grossProfit,
        grossMargin,
        itemsSold,
        avgSalePrice,
        avgProfitPerItem,
        monthLabel: tabName
      }
    };

  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return { error: error.message || "Failed to fetch analytics from Google Sheets." };
  }
}
