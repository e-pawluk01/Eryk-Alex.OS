// Finds each column by its header text, so the sheet's columns can be moved or
// added without breaking anything. Tabs made before the headers were renamed
// (August 2026) fall back to the old fixed layout until they are phased out.

export const COLUMN_HEADERS = {
  notes: "Notes",
  buy: "Sourced",
  sold: "Sold",
  sku: "SKU",
  timeToSell: "Time to Sell",
  upV: "UP(V)",
  uploadedOn: "Uploaded On",
  daysListed: "Days Listed",
  esp: "ESP",
  sourcedDate: "Sourced Date",
  fees: "Fees",
  ship: "Ship Cost",
  upD: "UP(D)",
  exitDate: "Exit Date",
  exit: "Exit",
  stage: "Stage",
  listedPrice: "Listed Price",
  stageDate: "Stage Date",
  currentPrice: "Current Price",
} as const;

export type ColumnKey = keyof typeof COLUMN_HEADERS;
export type ColumnMap = Partial<Record<ColumnKey, number>>;

// Old layout, A..N (0-indexed).
const LEGACY: ColumnMap = {
  notes: 0, buy: 1, sold: 2, sku: 3, timeToSell: 4, upV: 5, uploadedOn: 6,
  daysListed: 7, esp: 8, sourcedDate: 9, fees: 10, ship: 11, upD: 12, exitDate: 13,
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Column positions for a tab, from its header row. */
export function mapColumns(header: unknown[] = []): ColumnMap {
  const at = new Map(header.map((h, i) => [norm(h), i] as const));
  // A renamed tab always has these; the old layout has none of them.
  const named = ["sourced", "sold", "sku"].every((h) => at.has(h));
  if (!named) return LEGACY;

  const map: ColumnMap = {};
  for (const [key, title] of Object.entries(COLUMN_HEADERS) as [ColumnKey, string][]) {
    const i = at.get(norm(title));
    if (i !== undefined) map[key] = i;
  }
  return map;
}

/** A cell's trimmed text, or "" when the column is missing from this tab. */
export function cell(row: unknown[] | undefined, cols: ColumnMap, key: ColumnKey): string {
  const i = cols[key];
  return i === undefined || !row ? "" : String(row[i] ?? "").trim();
}

/** Spreadsheet column letter for a 0-based index (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}
