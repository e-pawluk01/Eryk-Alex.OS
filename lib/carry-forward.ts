import { getGoogleSheetsClient } from "./google-client";
import { COLUMN_HEADERS, type ColumnKey, mapColumns, cell } from "./sheet-columns";

const KEYS = Object.keys(COLUMN_HEADERS) as ColumnKey[];

/**
 * Copy every still-unsold row from `fromTab` into `toTab`, column by column
 * matched on header name, so the two tabs can lay their columns out
 * differently. Carrying the tickboxes, Stage and prices forward means an
 * item's listing status and ladder position follow it into the new month.
 *
 * "Unsold" = the Sourced cell has something in it, Sold does not parse to a
 * positive number, and Exit is empty (Sold / Bundled / Removed rows stay
 * behind). De-duplicates on SKU, so it is safe to run more than once.
 */
export async function carryForwardUnsold(fromTab: string, toTab: string) {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    return { error: "Google Sheets integration is missing environment variables." };
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = getGoogleSheetsClient();

  const [srcResp, dstResp] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${fromTab}'!A:Z` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${toTab}'!A:Z` }),
  ]);

  const srcRows: any[][] = srcResp.data.values || [];
  const dstRows: any[][] = dstResp.data.values || [];
  const src = mapColumns(srcRows[0]);
  const dst = mapColumns(dstRows[0]);
  if (dst.sku === undefined) return { error: `No "SKU" column in "${toTab}".` };
  const width = Math.max(...Object.values(dst)) + 1;

  const existingSkus = new Set(
    dstRows.slice(1).map((r) => cell(r, dst, "sku").toLowerCase()).filter(Boolean)
  );

  const toCopy: any[][] = [];
  let alreadyThere = 0;

  for (let i = 1; i < srcRows.length; i++) {
    const r = srcRows[i];
    const sfNum = parseFloat(cell(r, src, "sold").replace(/[^0-9.-]+/g, "")) || 0;
    const sku = cell(r, src, "sku");

    const inStock = cell(r, src, "buy") !== "" && !(sfNum > 0) && cell(r, src, "exit") === "";
    if (!inStock) continue;

    if (sku && existingSkus.has(sku.toLowerCase())) {
      alreadyThere++;
      continue;
    }

    const out: any[] = new Array(width).fill("");
    for (const key of KEYS) {
      const at = dst[key];
      if (at !== undefined && src[key] !== undefined) out[at] = r[src[key]!] ?? "";
    }
    if (dst.sold !== undefined) out[dst.sold] = ""; // sale price always starts blank
    toCopy.push(out);
    if (sku) existingSkus.add(sku.toLowerCase());
  }

  if (toCopy.length === 0) {
    return { copied: 0, alreadyThere, from: fromTab, to: toTab };
  }

  // Write directly after the last row with a real item on it. We can't trust
  // dstRows.length or `append`: a column of empty tickboxes reads "FALSE" all
  // the way down, making the sheet look ~1000 rows long. Only a note, a SKU or
  // a buy price marks a genuine row.
  let lastItemRow = 1; // header
  for (let i = 1; i < dstRows.length; i++) {
    const r = dstRows[i];
    if (cell(r, dst, "notes") || cell(r, dst, "sku") || cell(r, dst, "buy")) lastItemRow = i + 1;
  }
  const firstEmptyRow = lastItemRow + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${toTab}'!A${firstEmptyRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: toCopy },
  });

  await addHoldTickboxes(spreadsheetId, toTab, dstRows[0] || [], dst, toCopy, firstEmptyRow);

  return { copied: toCopy.length, alreadyThere, startRow: firstEmptyRow, from: fromTab, to: toTab };
}

// Items on Hold get a tickbox in "Item Checked", ticked when Eryk keeps one on
// Hold at a check-in. The Apps Script adds them as Stage changes, but it can't
// see rows written by the app, so carried Hold items get theirs here.
async function addHoldTickboxes(spreadsheetId: string, tab: string, header: unknown[], dst: ReturnType<typeof mapColumns>, rows: any[][], firstRow: number) {
  const col = header.findIndex((h) => String(h ?? "").trim().toLowerCase() === "item checked");
  if (col === -1 || dst.stage === undefined) return;
  const holdRows = rows.map((r, i) => (String(r[dst.stage!]).trim().toLowerCase() === "hold" ? firstRow - 1 + i : -1)).filter((i) => i >= 0);
  if (!holdRows.length) return;

  const sheets = getGoogleSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: holdRows.map((row) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { dataValidation: { condition: { type: "BOOLEAN" } }, userEnteredValue: { boolValue: false } },
          fields: "dataValidation,userEnteredValue",
        },
      })),
    },
  });
}
