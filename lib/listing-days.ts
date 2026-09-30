import { type ColumnMap, cell } from "./sheet-columns";

// "2026-09-28" (as the script writes dates) or "28/09/2026" / "28/09/2026 14:02:11"
// (as the sheet shows a date cell) -> a UTC day, or null.
export function parseSheetDate(raw: string): Date | null {
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const uk = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (uk) return new Date(Date.UTC(+uk[3], +uk[2] - 1, +uk[1]));
  return null;
}

const DAY_MS = 86_400_000;

/**
 * Days an item has actually been listed, as of `asOf`: the finished stretches
 * in Days Listed plus the one still running since Uploaded On. Null when the
 * sheet says nothing about it (never ticked as listed).
 */
export function daysListed(row: unknown[], cols: ColumnMap, asOf: Date): number | null {
  const doneText = cell(row, cols, "daysListed");
  const done = doneText === "" ? null : Number(doneText);
  const since = parseSheetDate(cell(row, cols, "uploadedOn"));
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const running = since ? Math.max(0, Math.round((today - since.getTime()) / DAY_MS)) : null;
  if (running === null && (done === null || !Number.isFinite(done))) return null;
  return (Number.isFinite(done) ? done! : 0) + (running ?? 0);
}
