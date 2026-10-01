import { getGoogleSheetsClient } from "./google-client";
import { mapColumns, cell } from "./sheet-columns";
import { daysListed, parseSheetDate } from "./listing-days";
import type { LadderItem } from "./listing-ladder";

const money = (s: string) => parseFloat(s.replace(/[^0-9.-]+/g, "")) || 0;
const STAGES = new Set(["1", "2", "3"]);

/** "Oct 26" for a date, in UK time. */
export function monthTabName(d: Date) {
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "Europe/London" }).slice(0, 3);
  const year = d.toLocaleString("en-GB", { year: "2-digit", timeZone: "Europe/London" });
  return `${month} ${year}`;
}

/**
 * Every live listing on this month's tab: unsold, not exited, and ticked as
 * listed on Vinted or Depop (drafts aren't live, so they're not on the ladder).
 */
export async function readLadderItems(today: Date): Promise<LadderItem[]> {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    throw new Error("Google Sheets integration is missing environment variables.");
  }
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = getGoogleSheetsClient();
  const target = monthTabName(today).replace(/\s+/g, "").toLowerCase();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets?.find((s: any) => s.properties?.title?.replace(/\s+/g, "").toLowerCase() === target)?.properties?.title;
  if (!tab) throw new Error(`No sheet tab found for "${monthTabName(today)}".`);

  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:Z` });
  const rows: any[][] = resp.data.values || [];
  const cols = mapColumns(rows[0]);
  const listed = (v: string) => v.toUpperCase() === "TRUE";

  return rows.slice(1).flatMap((r): LadderItem[] => {
    const sku = cell(r, cols, "sku");
    if (!sku || money(cell(r, cols, "sold")) > 0 || cell(r, cols, "exit") !== "") return [];
    if (!listed(cell(r, cols, "upV")) && !listed(cell(r, cols, "upD"))) return [];
    const stageText = cell(r, cols, "stage");
    const stage = stageText.toLowerCase() === "hold" ? "Hold" : STAGES.has(stageText) ? (stageText as "1" | "2" | "3") : "";
    const stageDate = parseSheetDate(cell(r, cols, "stageDate"));
    const listedText = cell(r, cols, "listedPrice"), espText = cell(r, cols, "esp");
    return [{
      sku,
      note: cell(r, cols, "notes"),
      buy: money(cell(r, cols, "buy")),
      costs: money(cell(r, cols, "fees")) + money(cell(r, cols, "ship")),
      listedPrice: listedText ? money(listedText) : null,
      esp: espText && money(espText) > 0 ? money(espText) : null,
      stage,
      stageDate: stageDate ? stageDate.toISOString().slice(0, 10) : null,
      daysListed: daysListed(r, cols, today),
    }];
  });
}
