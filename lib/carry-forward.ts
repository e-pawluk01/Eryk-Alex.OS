import { getGoogleSheetsClient } from "./google-client";

// Columns A..J (0-indexed): A notes, B SP, C SF, D SKU, E TTS, F UP,
// G listing-start, H accum-days, I ESP, J sourced-date.
const COLS = 10;
const IDX_SP = 1;
const IDX_SF = 2;
const IDX_SKU = 3;

/**
 * Copy every still-unsold row from `fromTab` into `toTab`.
 *
 * "Unsold" = SP cell has something in it and SF does not parse to a positive
 * number (matches the in-stock rule in lib/sheets.ts). Sold rows stay behind.
 * De-duplicates on SKU, so it is safe to run more than once.
 */
export async function carryForwardUnsold(fromTab: string, toTab: string) {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    return { error: "Google Sheets integration is missing environment variables." };
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = getGoogleSheetsClient();

  const [srcResp, dstResp] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${fromTab}'!A:J` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${toTab}'!A:J` }),
  ]);

  const srcRows: any[][] = srcResp.data.values || [];
  const dstRows: any[][] = dstResp.data.values || [];

  const existingSkus = new Set(
    dstRows.slice(1)
      .map((r) => (r[IDX_SKU] ?? "").toString().trim().toLowerCase())
      .filter(Boolean)
  );

  const toCopy: any[][] = [];
  let alreadyThere = 0;

  for (let i = 1; i < srcRows.length; i++) {
    const r = srcRows[i];
    const sp = (r[IDX_SP] ?? "").toString().trim();
    const sfStr = (r[IDX_SF] ?? "").toString().trim();
    const sfNum = parseFloat(sfStr.replace(/[^0-9.-]+/g, "")) || 0;
    const sku = (r[IDX_SKU] ?? "").toString().trim();

    const inStock = sp !== "" && !(sfNum > 0);
    if (!inStock) continue;

    if (sku && existingSkus.has(sku.toLowerCase())) {
      alreadyThere++;
      continue;
    }

    const out: any[] = [];
    for (let c = 0; c < COLS; c++) out[c] = r[c] ?? "";
    out[IDX_SF] = ""; // ensure sale price is blank in the new tab
    toCopy.push(out);
    if (sku) existingSkus.add(sku.toLowerCase());
  }

  if (toCopy.length === 0) {
    return { copied: 0, alreadyThere, from: fromTab, to: toTab };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${toTab}'!A:J`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: toCopy },
  });

  return { copied: toCopy.length, alreadyThere, from: fromTab, to: toTab };
}
