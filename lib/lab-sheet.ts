import { getGoogleSheetsClient } from "./google-client";
import { parseSheetDate } from "./listing-days";

// The Lab sheet (custom designs under test) is its own spreadsheet, named by
// LAB_SHEET_ID. Each design gets a three-week test window (Start → End); once
// End has passed and Status is still In-progress, a decision is due:
// Scale, Adjust or Drop.

export interface LabDecision { sku: string; name: string; end: string } // end: "yyyy-MM-dd"

const norm = (v: unknown) => String(v ?? "").trim();

/** Designs whose test has ended without a decision. Empty if there's no Lab sheet. */
export async function readLabDecisionsDue(todayKey: string): Promise<LabDecision[]> {
  const spreadsheetId = process.env.LAB_SHEET_ID;
  if (!spreadsheetId || !process.env.GOOGLE_OAUTH_REFRESH_TOKEN) return [];
  const sheets = getGoogleSheetsClient();

  // One running tab: the first in the spreadsheet that isn't the Log.
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const tab = meta.data.sheets?.map((s) => s.properties?.title ?? "").find((t) => t && t.toLowerCase() !== "log");
  if (!tab) return [];

  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:Z` });
  const [header = [], ...rows] = (resp.data.values || []) as unknown[][];
  const at = (name: string) => header.findIndex((h) => norm(h).toLowerCase() === name);
  const col = { sku: at("sku"), name: at("name"), status: at("status"), end: at("end") };
  if (col.status === -1 || col.end === -1) return [];

  const due: LabDecision[] = [];
  for (const r of rows) {
    if (norm(r[col.status]).toLowerCase() !== "in-progress") continue;
    const end = parseSheetDate(norm(r[col.end]));
    if (!end) continue;
    const endKey = end.toISOString().slice(0, 10);
    if (endKey <= todayKey) due.push({ sku: norm(r[col.sku]), name: norm(r[col.name]), end: endKey });
  }
  return due.sort((a, b) => a.end.localeCompare(b.end));
}
