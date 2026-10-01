import { categoryOf } from "./categories";

// The listing ladder, as written in the reference page "How the listing email
// works" (Oct 2026). The Stage column holds the last step done; this works out
// each live listing's next step, when it's due, and which ones go in today's
// email. The email itself only displays the result.
//
//   Stage blank → Stage 1 refresh            1x days to sell after listing
//   Stage 1     → Stage 2 refresh + reprice  ½x after Stage 1
//   Stage 2     → Stage 3 refresh + bigger   ½x after Stage 2
//   Stage 3     → Check-in                   1x after Stage 3
//   Hold        → Check-in again             1x after the last check-in
//
// Days to sell starts at 28 days (the starting timings 4 / 2 / 2 / 4 weeks)
// and blends towards each category's own figure as its sales build up.
// Days count only while an item is listed.

export interface LadderItem {
  sku: string;
  note: string;
  buy: number;
  costs: number;               // fees + shipping already on the row
  listedPrice: number | null;  // original asking price
  esp: number | null;          // lowest acceptable price
  stage: "" | "1" | "2" | "3" | "Hold";
  stageDate: string | null;    // "yyyy-MM-dd", stamped when Stage last changed
  daysListed: number | null;
}

export type Step = "stage1" | "stage2" | "stage3" | "checkin";

export interface DueItem {
  item: LadderItem;
  step: Step;
  due: number;                 // days from today (negative = overdue)
  latest: number;              // safety limit: due + a quarter of the step
  floor: number | null;
  prices: { interest: number; none: number } | null; // Stage 2 and 3 only
}

const DAY = 86_400_000;
// The day the ladder went live. Older Stage 3 / Hold items (no Stage Date)
// are spread over one check-in gap from here.
export const LADDER_START = "2026-10-01";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dayNumber = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY);

/** Gaps for a category's days to sell (advisor's limits: 14–42 and 7–21 days). */
export function timings(daysToSell: number) {
  const full = clamp(Math.round(daysToSell), 14, 42);
  return { first: full, gap: clamp(Math.round(daysToSell / 2), 7, 21), final: full };
}

// Never below the ESP, and never at a loss.
function floorOf(i: LadderItem): number | null {
  const lossLine = i.buy + i.costs;
  if (i.esp === null && lossLine <= 0) return null;
  return Math.ceil(Math.max(i.esp ?? 0, lossLine));
}

// A share of the gap between the original listed price and the floor,
// rounded down to £1, never below the floor.
function pricesFor(i: LadderItem, step: Step, floor: number | null) {
  if ((step !== "stage2" && step !== "stage3") || i.listedPrice === null || floor === null) return null;
  const gap = Math.max(0, i.listedPrice - floor);
  const at = (share: number) => Math.max(floor, Math.floor(i.listedPrice! - gap * share));
  return step === "stage2" ? { interest: at(1 / 4), none: at(1 / 3) } : { interest: at(1 / 2), none: floor };
}

const NEXT: Record<LadderItem["stage"], Step> = { "": "stage1", "1": "stage2", "2": "stage3", "3": "checkin", "Hold": "checkin" };

/**
 * Every live listing's next step and when it's due (in days from today).
 * `daysToSellOf` gives a category's blended days to sell.
 */
export function schedule(items: LadderItem[], daysToSellOf: (category: string) => number, todayKey: string): DueItem[] {
  const today = dayNumber(todayKey);
  const out: DueItem[] = [];

  // Older stock: Stage 3 / Hold with no Stage Date, oldest first, spread
  // evenly over what's left of one check-in gap from the ladder's start.
  const older = items.filter((i) => (i.stage === "3" || i.stage === "Hold") && !i.stageDate)
    .sort((a, b) => (b.daysListed ?? 0) - (a.daysListed ?? 0));

  for (const i of items) {
    const t = timings(daysToSellOf(categoryOf(i.sku, i.note)));
    const step = NEXT[i.stage];
    let wait: number, due: number;

    if (i.stage === "") {
      if (i.daysListed === null) continue;
      wait = t.first;
      due = t.first - i.daysListed;
    } else if (i.stageDate) {
      wait = step === "checkin" ? t.final : t.gap;
      due = dayNumber(i.stageDate) + wait - today;
    } else if (step === "checkin") {
      wait = t.final;
      const left = dayNumber(LADDER_START) + t.final - today;
      due = left <= 0 ? 0 : Math.floor((older.indexOf(i) * left) / older.length);
    } else {
      // Stage 1 or 2 with no date (set before Stage Date existed): place it by
      // how long it has been listed.
      if (i.daysListed === null) continue;
      wait = t.gap;
      due = (i.stage === "1" ? t.first + t.gap : t.first + 2 * t.gap) - i.daysListed;
    }

    const floor = floorOf(i);
    out.push({ item: i, step, due, latest: due + Math.ceil(wait / 4), floor, prices: pricesFor(i, step, floor) });
  }
  return out;
}

/**
 * Today's list from one pool (refreshes or check-ins): everything due today,
 * plus items brought forward (never more than a quarter of their step early)
 * when that's needed so nothing later goes past its safety limit.
 */
function pickToday(pool: DueItem[]): DueItem[] {
  const dueNow = pool.filter((d) => d.due <= 0).length;
  let need = 0;
  const horizon = Math.max(0, ...pool.map((d) => d.latest));
  for (let day = 0; day <= horizon; day++) {
    const mustBeDone = pool.filter((d) => d.latest <= day).length;
    need = Math.max(need, Math.ceil(mustBeDone / (day + 1)));
  }
  const quarter = (d: DueItem) => d.latest - d.due; // a quarter of its step
  return pool
    .filter((d) => d.due <= quarter(d)) // never more than that early
    .sort((a, b) => a.latest - b.latest || (b.item.daysListed ?? 0) - (a.item.daysListed ?? 0))
    .slice(0, Math.max(dueNow, need));
}

export function todaysList(all: DueItem[]) {
  const refreshes = pickToday(all.filter((d) => d.step !== "checkin"));
  const checkins = pickToday(all.filter((d) => d.step === "checkin"));
  const shown = new Set([...refreshes, ...checkins]);
  return {
    refreshes,
    checkins,
    waiting: all.filter((d) => d.due <= 0 && !shown.has(d)).length,
    pastLimit: all.filter((d) => d.latest < 0).length,
  };
}
