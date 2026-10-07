import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { StudyDeadline } from "./types";

// Each person's usual deadline types. Any other type they type in is kept
// and offered again next time.
export const DEFAULT_TYPES: Record<string, string[]> = {
  Eryk: ["Final exam", "TMA", "iCMA"],
  Alex: ["Essay"],
};

export function typesFor(person: string, deadlines: StudyDeadline[]) {
  const used = deadlines.map(d => d.type);
  return Array.from(new Set([...(DEFAULT_TYPES[person] ?? []), ...used]));
}

// Module colours. Red, amber and green are left out: they mean urgency.
export const MODULE_COLORS = ["#2bb3c0", "#9085e9", "#a3c13d", "#3987e5", "#d55181", "#8fbdf2", "#a87b4f", "#9ca3af"];

export function daysUntil(date: string) {
  return differenceInCalendarDays(parseISO(date), startOfDay(new Date()));
}

/** 0 = more than 14 days, 1 = 8–14, 2 = 4–7, 3 = 3 days or less (or late). */
export function urgency(days: number) {
  return days <= 3 ? 3 : days <= 7 ? 2 : days <= 14 ? 1 : 0;
}

export const URGENCY_TEXT = ["text-muted-foreground", "text-white", "text-[#e0a33a]", "text-[#e66767]"];
export const URGENCY_BORDER = ["border-border", "border-border", "border-[#e0a33a]/35", "border-[#e66767]/45"];

export function countdown(days: number) {
  if (days < 0) return `${-days}d late`;
  if (days === 0) return "today";
  return days < 60 ? `${days}d` : `${Math.round(days / 30)}mo`;
}

export function shortDate(date: string) {
  return format(parseISO(date), "EEE d MMM");
}

export function shortTime(time: string | null) {
  return time ? time.slice(0, 5) : null;
}

export function isOpenNow(d: StudyDeadline) {
  return !d.opens_on || daysUntil(d.opens_on) <= 0;
}

/** Share of the open window already gone, 0–100, or null with no start date. */
export function windowGone(d: StudyDeadline) {
  if (!d.opens_on) return null;
  const total = differenceInCalendarDays(parseISO(d.cutoff_on), parseISO(d.opens_on));
  if (total <= 0) return 100;
  const gone = differenceInCalendarDays(startOfDay(new Date()), parseISO(d.opens_on));
  return Math.max(0, Math.min(100, (gone / total) * 100));
}

export function byCutoff(a: StudyDeadline, b: StudyDeadline) {
  return a.cutoff_on.localeCompare(b.cutoff_on) || (a.cutoff_time ?? "").localeCompare(b.cutoff_time ?? "");
}
