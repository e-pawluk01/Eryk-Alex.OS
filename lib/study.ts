import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { StudyDeadline } from "./types";
import { TASK_COLORS } from "./work-sessions";

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

// Module colours: the same set the Work charts use.
export const MODULE_COLORS = Object.values(TASK_COLORS);

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

export const MATERIAL_UNITS = ["pages", "chapters", "lectures"];

/** "12 pages a day to finish by 20 Oct", or null when there's no target. */
export function paceLine(m: { total: number | null; current: number; unit: string | null; finish_by: string | null }) {
  if (!m.total || !m.finish_by || m.current >= m.total) return null;
  const days = daysUntil(m.finish_by);
  const left = m.total - m.current;
  if (days <= 0) return `${left} ${m.unit ?? ""} left, finish date passed`;
  return `${Math.ceil(left / days)} ${m.unit ?? ""} a day to finish by ${format(parseISO(m.finish_by), "d MMM")}`;
}

export function progressText(m: { total: number | null; current: number; unit: string | null }) {
  if (!m.total) return "no total";
  return m.unit === "pages" ? `p.${m.current} / ${m.total}` : `${m.current} / ${m.total} ${m.unit ?? ""}`.trim();
}
