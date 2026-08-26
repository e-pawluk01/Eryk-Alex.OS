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

export async function getMonthlyAnalytics(dateIso?: string) {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    return { error: "Google Sheets integration is missing environment variables." };
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const date = dateIso ? new Date(dateIso) : new Date();
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
    
    // Store raw sales details for PDF snapshot
    const salesTable = [];

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
        
        // Push sales row strictly adhering to requested columns (no Item Name, no UP)
        // Headers: Notes (0), Buy (1), Sold (2), SKU (3), TTS (4), Upload Platform (5)
        salesTable.push({
          sku: row[3] || "N/A",
          buy: spValue,
          sold: sfValue,
          profit: sfValue - spValue,
          tts: row[4] || "N/A"
        });
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
        monthLabel: tabName,
        salesTable
      }
    };

  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return { error: error.message || "Failed to fetch analytics from Google Sheets." };
  }
}

export async function createNextMonthTab(newMonthName: string) {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    return { error: "Google Sheets integration is missing environment variables." };
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheets = getGoogleSheetsClient();
    
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets || [];
    
    // 1. Guard against duplicates
    const targetNormalized = newMonthName.replace(/\s+/g, "").toLowerCase();
    const alreadyExists = existingSheets.find(
      (s: any) => s.properties?.title?.replace(/\s+/g, "").toLowerCase() === targetNormalized
    );

    if (alreadyExists) {
      console.log(`Tab '${newMonthName}' already exists. Skipping creation.`);
      return { success: true, skipped: true };
    }

    // 2. Find Template tab
    const templateSheet = existingSheets.find(
      (s: any) => s.properties?.title?.toLowerCase() === "template"
    );

    if (!templateSheet || templateSheet.properties?.sheetId === undefined) {
      throw new Error("Could not find 'Template' tab in Google Sheets to duplicate.");
    }

    // 3. Duplicate and Rename
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: templateSheet.properties.sheetId,
              insertSheetIndex: 0,
              newSheetName: newMonthName
            }
          }
        ]
      }
    });

    console.log(`Successfully created new tab: ${newMonthName}`);
    return { success: true, skipped: false };
  } catch (error: any) {
    console.error("Error creating new tab:", error);
    return { error: error.message || "Failed to create next month tab." };
  }
}
