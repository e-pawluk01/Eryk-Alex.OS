// One stock row as Stock Health needs it: what it cost, where it went and
// when, and how long it was listed. Dates are "yyyy-MM-dd".
export interface SheetItem {
  sku: string;
  buy: number;
  esp: number | null;
  status: "stock" | "sold" | "removed"; // sold includes bundled
  exitOn: string | null;                // Exit Date, for sold or removed
  sourcedOn: string | null;             // Sourced Date: when it was added to the sheet
  days: number | null;                  // days listed: at sale, at removal, or so far
  sourcedFrom: string;                  // Sourced From ("" when blank)
}
