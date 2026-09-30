import { getGoogleSheetsClient } from "./google-client";
import { supabaseAdmin } from "./supabase-admin";
import { SKU_CODE_BY_NAME } from "./sku-categories";
import { mapColumns, cell, columnLetter } from "./sheet-columns";

function currentMonthTabName(): string {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear().toString().slice(2);
  return `${month} ${year}`;
}

/**
 * Atomically reserve the next SKU for a category, then drop a stub row
 * (SKU only) into the current month's sheet tab. The SKU is always returned
 * even if the sheet write fails — the number is reserved regardless.
 */
export async function generateSku(category: string) {
  const code = SKU_CODE_BY_NAME.get(category);
  if (!code) return { error: `Unknown category: ${category}` };

  const { data: sku, error } = await supabaseAdmin.rpc("generate_next_sku", { sku_prefix: code });
  if (error || !sku) {
    return { error: error?.message || "Failed to reserve a SKU number." };
  }

  let sheetTab: string | null = null;
  let sheetError: string | null = null;
  try {
    sheetTab = await appendSkuRow(sku as string);
  } catch (e: any) {
    sheetError = e?.message || "Could not write to the sheet.";
  }

  return { sku: sku as string, sheetTab, sheetError };
}

async function appendSkuRow(sku: string): Promise<string> {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    throw new Error("Google Sheets integration is missing environment variables.");
  }
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = getGoogleSheetsClient();

  // Resolve the current month tab, spaces / capitalisation ignored.
  const target = currentMonthTabName().replace(/\s+/g, "").toLowerCase();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets
    ?.find((s: any) => s.properties?.title?.replace(/\s+/g, "").toLowerCase() === target)
    ?.properties?.title;
  if (!tab) throw new Error(`No sheet tab found for "${currentMonthTabName()}".`);

  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:Z` });
  const rows: any[][] = resp.data.values || [];
  const cols = mapColumns(rows[0]);
  if (cols.sku === undefined) throw new Error(`No "SKU" column in "${tab}".`);

  // The row count can't be trusted: a column of empty tickboxes reads "FALSE"
  // all the way down. Only a note, a SKU or a buy price marks a genuine row.
  let lastItemRow = 1; // header
  rows.forEach((r, i) => {
    if (i > 0 && (cell(r, cols, "notes") || cell(r, cols, "sku") || cell(r, cols, "buy"))) lastItemRow = i + 1;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!${columnLetter(cols.sku)}${lastItemRow + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[sku]] },
  });

  return tab;
}
