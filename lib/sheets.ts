"use server";

import { unstable_cache } from "next/cache";
import { getGoogleSheetsClient } from "./google-client";
import { mapColumns, cell } from "./sheet-columns";
import { daysListed, parseSheetDate } from "./listing-days";
import type { SheetItem } from "./sheet-item";

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
      range: `'${tabName}'!A:Z`, // every column; they are found by header name
    });
    return response.data.values || [];
  },
  ["sheets-tab-data"], 
  { revalidate: 300 } // 5 minutes
);

// Sold dates come back as the sheet displays them: "2026-10-05" as the
// script writes it, or "05/10/2026" if the cell got turned into a UK date.
function soldDateKey(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const uk = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * @param soldBy "yyyy-MM-dd" — when given, only sales with a Sold date on or
 * before this day count towards the sales metrics (for like-for-like
 * comparisons against part of a month).
 */
export async function getMonthlyAnalytics(dateIso?: string, soldBy?: string) {
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
    let sellingCosts = 0; // Depop/marketplace fees + postage you paid, on sold items
    let sellingFees = 0;
    let shippingCosts = 0;
    let writtenOff = 0; // buy price of items removed this month (donated, binned, kept)
    let itemsSold = 0;
    // True only if every sold row has a readable Exit Date.
    let soldDatesComplete = true;

    // Inventory tracking
    let inventoryCost = 0;
    let itemsInStock = 0;
    let expectedRevenue = 0;
    let expectedProfit = 0;
    let espItemCount = 0;
    const stockSkus: string[] = []; // SKUs still in stock, for per-category sell-through
    // For Categories: how long each unsold / removed item has been listed.
    const stockItems: { sku: string; days: number | null }[] = [];
    const removedItems: { sku: string; days: number | null; exitOn: string | null }[] = [];
    const items: SheetItem[] = []; // every stock row, for Stock Health
    const today = new Date();
    
    // Store raw sales details for PDF snapshot
    const salesTable: any[] = [];

    const cols = mapColumns(rows[0]);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const spStr   = cell(row, cols, "buy");
      const sfStr   = cell(row, cols, "sold");
      const espStr  = cell(row, cols, "esp");
      const feeStr  = cell(row, cols, "fees");
      const shipStr = cell(row, cols, "ship");

      const spValue  = parseFloat(spStr.replace(/[^0-9.-]+/g, ""))  || 0;
      const sfValue  = parseFloat(sfStr.replace(/[^0-9.-]+/g, ""))  || 0;
      const espValue = parseFloat(espStr.replace(/[^0-9.-]+/g, "")) || 0;
      const feeValue  = parseFloat(feeStr.replace(/[^0-9.-]+/g, ""))  || 0;
      const shipValue = parseFloat(shipStr.replace(/[^0-9.-]+/g, "")) || 0;

      // An item is IN STOCK if the SP cell has ANYTHING in it — a price, "£0",
      // or a placeholder like "Ask Alex" — and it has not sold. It still counts
      // as an item even when SP doesn't parse to a number; it just adds £0 to cost.
      const hasSP  = spStr !== "";
      const isSold = sfValue > 0;
      // Taken off sale for good (donated, binned, kept): neither sold nor stock.
      const isRemoved = cell(row, cols, "exit").toLowerCase() === "removed";

      const soldOn = soldDateKey(cell(row, cols, "exitDate"));
      if (isSold && !soldOn) soldDatesComplete = false;

      // A SKU with nothing else (a stub the SKU button made) isn't stock yet.
      if (hasSP || isSold || isRemoved) {
        const tts = Number(cell(row, cols, "timeToSell"));
        items.push({
          sku: cell(row, cols, "sku"),
          buy: spValue,
          esp: espValue > 0 ? espValue : null,
          status: isSold ? "sold" : isRemoved ? "removed" : "stock",
          exitOn: soldOn,
          sourcedOn: soldDateKey(cell(row, cols, "sourcedDate")),
          days: isSold
            ? (cell(row, cols, "timeToSell") !== "" && Number.isFinite(tts) ? tts : null)
            : daysListed(row, cols, isRemoved ? parseSheetDate(cell(row, cols, "exitDate")) ?? today : today),
        });
      }

      if (isSold && soldBy && (!soldOn || soldOn > soldBy)) {
        // Sold after the cut-off day: outside a like-for-like window.
      } else if (isSold) {
        // SOLD — contributes to monthly metrics only
        revenue      += sfValue;
        cogs         += spValue;
        sellingCosts += feeValue + shipValue;
        sellingFees  += feeValue;
        shippingCosts += shipValue;
        itemsSold++;

        salesTable.push({
          sku:    cell(row, cols, "sku") || "N/A",
          buy:    spValue,
          sold:   sfValue,
          fees:   feeValue,
          ship:   shipValue,
          profit: sfValue - spValue - feeValue - shipValue,
          tts:    cell(row, cols, "timeToSell") || "N/A",
          soldOn: soldOn,
          note:   cell(row, cols, "notes"),
        });
      } else if (isRemoved) {
        // The money was spent, so it counts as a cost in the month it was removed.
        if (!(soldBy && (!soldOn || soldOn > soldBy))) writtenOff += spValue;
        // Its listing clock stops on the day it was removed.
        const removedOn = parseSheetDate(cell(row, cols, "exitDate")) ?? today;
        removedItems.push({ sku: cell(row, cols, "sku"), days: daysListed(row, cols, removedOn), exitOn: soldOn });
      } else if (hasSP) {
        // UNSOLD INVENTORY
        inventoryCost += spValue;
        itemsInStock++;
        stockSkus.push(cell(row, cols, "sku"));
        stockItems.push({ sku: cell(row, cols, "sku"), days: daysListed(row, cols, today) });

        if (espValue > 0) {
          expectedRevenue += espValue;
          expectedProfit  += espValue - spValue;
          espItemCount++;
        }
      }
    }

    const grossProfit        = revenue - cogs - sellingCosts - writtenOff;
    const grossMargin        = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const avgSalePrice       = itemsSold > 0 ? revenue / itemsSold : 0;
    const avgProfitPerItem   = itemsSold > 0 ? grossProfit / itemsSold : 0;
    const avgExpectedSalePrice = espItemCount > 0 ? expectedRevenue / espItemCount : null;
    const returnOnCost = cogs > 0 ? (grossProfit / cogs) * 100 : null;

    return {
      data: {
        // Monthly metrics
        revenue,
        cogs,
        sellingCosts,
        sellingFees,
        shippingCosts,
        writtenOff,
        grossProfit,
        grossMargin,
        itemsSold,
        avgSalePrice,
        avgProfitPerItem,
        monthLabel: tabName,
        salesTable,
        soldDatesComplete,
        // Inventory metrics (null = no ESP data available, render as "—")
        inventoryCost,
        itemsInStock,
        stockSkus,
        stockItems,
        removedItems,
        items,
        returnOnCost,
        expectedRevenue:    espItemCount > 0 ? expectedRevenue    : null,
        expectedProfit:     espItemCount > 0 ? expectedProfit     : null,
        avgExpectedSalePrice
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
