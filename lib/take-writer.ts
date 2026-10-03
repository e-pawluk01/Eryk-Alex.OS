import { METRIC_NAMES, type Facts, type MetricKey } from "./take-facts";

// Claude writes the monthly take from the facts sheet, nothing else. Every
// number it writes is checked against the facts it was given; one retry, and
// if that fails too the email goes out without the written parts.

export const TAKE_MODEL = "anthropic/claude-opus-5.5";

export interface Written {
  reason: string;          // the rest of the headline after the verdict
  changed: string[];       // confirmed changes only
  why: string | null;
  actions: { do: string; because: string; check: string; metric: MetricKey; direction: "up" | "down" }[];
  watch: string[];
}

const gbp = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function fmt(key: MetricKey, v: number | null) {
  if (v === null) return "n/a";
  if (key === "average_sale" || key === "profit_per_sale" || key === "gross_profit") return gbp(v);
  if (key === "sell_through") return pct(v);
  if (key === "days_to_sell") return `${Math.round(v)} days`;
  return String(Math.round(v));
}

/** The facts as the model sees them: plain text, every number pre-formatted. */
export function factsText(f: Facts): string {
  const lines: string[] = [];
  lines.push(`Month: ${f.monthName}`);
  lines.push(`Verdict (decided in code, do not change): ${f.verdict}`);
  lines.push(f.firstTake ? "This is the first monthly take: there are no earlier takes, so nothing can be confirmed." : "There is a take from last month.");
  lines.push(`A change only matters if it's worth more than one average sale's profit: ${gbp(f.matterLine)}.`);
  lines.push("");
  lines.push("FIGURES (this month | last month | normal = average of earlier months | flag)");
  for (const m of Object.values(f.metrics)) {
    if (m.value === null) continue;
    const flag = m.change ? `${m.change === "up" ? "UP" : "DOWN"}, ${m.confirmed ? "CONFIRMED (second month running)" : "first time: watch only"}, worth ${gbp(Math.abs(m.money ?? 0))}` : "not worth mentioning";
    lines.push(`- ${m.key} (${METRIC_NAMES[m.key]}): ${fmt(m.key, m.value)} | ${fmt(m.key, m.last)} | ${m.normal === null ? "n/a" : `${fmt(m.key, m.normal)} over ${m.normalMonths} month${m.normalMonths === 1 ? "" : "s"}`} | ${flag}`);
  }
  const confirmed = Object.values(f.metrics).filter((m) => m.confirmed);
  lines.push("");
  lines.push(`CONFIRMED CHANGES (the only things allowed under "changed"): ${confirmed.length ? confirmed.map((m) => m.key).join(", ") : "none"}`);
  const rp = f.revenueParts;
  lines.push(`REVENUE PARTS (last month → this month): items sold ${rp.itemsSold[0] ?? "n/a"} → ${rp.itemsSold[1]}; average sale ${rp.averageSale[0] === null ? "n/a" : gbp(rp.averageSale[0])} → ${gbp(rp.averageSale[1])}; revenue ${rp.revenue[0] === null ? "n/a" : gbp(rp.revenue[0])} → ${gbp(rp.revenue[1])}`);
  if (f.ladder) lines.push(`LISTING LADDER: ${f.ladder.finished} of ${f.ladder.live} live listings have finished the ladder (Stage 3 or Hold).`);
  if (f.categories.length) {
    lines.push("");
    lines.push("CATEGORIES (sold | stocked | sell-through | profit per item stocked | days to sell | early read? | signal)");
    for (const c of f.categories) {
      lines.push(`- ${c.name}: ${c.sold} | ${c.stocked} | ${pct(c.sellThrough)} | ${gbp(c.perItem)} | ${c.days === null ? "n/a" : `${c.days} days`} | ${c.early ? "early read" : "solid"} | ${c.signal}`);
    }
  }
  if (f.earlyReads.length) {
    lines.push(`EARLY READS ALLOWED IN "watch" (max 2): ${f.earlyReads.map((e) => `${e.name} (only ${e.sold} sold${e.days === null ? "" : `, about ${e.days} days to sell`}, sell-through ${pct(e.sellThrough)})`).join("; ")}`);
  }
  if (f.platforms.length) lines.push(`PLATFORMS: ${f.platforms.map((p) => `${p.name} ${p.sales} sales, ${gbp(p.profit)} profit`).join("; ")}`);
  lines.push("");
  lines.push(`METRICS AN ACTION CAN BE CHECKED BY: ${Object.keys(f.metrics).join(", ")}`);
  return lines.join("\n");
}

const SYSTEM = `You write a short monthly business email for Eryk and Alex, who resell second-hand clothes on Vinted and Depop. You are given a facts sheet. Code has already done every calculation and decided what is worth mentioning. Your only job is to write it up clearly.

Hard rules:
- Use only numbers that appear in the facts sheet, written exactly as they appear there. Never calculate, round differently, add, subtract or estimate.
- "changed": only the CONFIRMED CHANGES. If there are none, return an empty list.
- "reason": one short sentence that follows the verdict. For "baseline", say what it's a baseline against. No new numbers unless they're in the facts.
- "why": only when there are confirmed changes; explain them using the REVENUE PARTS (fewer items sold vs each selling for less). Otherwise null. Outside causes (season, platform algorithm) must start with "Possible:" and never drive an action.
- "actions": at most 3, ranked, each based on a figure in the facts. Each has "do" (what to do, plain and specific), "because" (the figure behind it), "check" (what to look at next month, in words), "metric" (one key from METRICS AN ACTION CAN BE CHECKED BY) and "direction" ("up" or "down", the way that metric should move). An early read can only earn a small test ("source a few more to find out"), never a scale-up. Never invent quantities or prices that aren't in the facts.
- "watch": at most 3 lines: first-time flags and up to 2 early reads, each early read with its item count ("only 6 sold so far").
- Never mention margin %, return on cost, top flips, or hours by person.
- Plain, direct British English. No hype, no emoji, no exclamation marks. About 150 words in total across all fields.

Reply with JSON only, no other text:
{"reason": string, "changed": [string], "why": string | null, "actions": [{"do": string, "because": string, "check": string, "metric": string, "direction": "up" | "down"}], "watch": [string]}`;

// Numbers in a piece of text, ignoring £, % and thousands commas.
const numbersIn = (text: string) => (text.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

/** Numbers in the written text that aren't in the facts. Empty = passed. */
export function strayNumbers(written: Written, facts: string): number[] {
  const allowed = new Set<number>();
  for (const n of numbersIn(facts)) for (const d of [0, 1, 2]) allowed.add(Number(n.toFixed(d)));
  const text = [written.reason, ...written.changed, written.why ?? "", ...written.actions.flatMap((a) => [a.do, a.because, a.check]), ...written.watch].join(" ");
  return numbersIn(text).filter((n) => !allowed.has(n));
}

function parse(raw: string, metrics: string[]): Written | null {
  try {
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
    return {
      reason: str(j.reason),
      changed: list(j.changed),
      why: str(j.why) || null,
      actions: (Array.isArray(j.actions) ? j.actions : []).slice(0, 3)
        .filter((a: any) => metrics.includes(a?.metric) && str(a?.do))
        .map((a: any) => ({ do: str(a.do), because: str(a.because), check: str(a.check), metric: a.metric, direction: a.direction === "down" ? "down" : "up" })),
      watch: list(j.watch).slice(0, 3),
    };
  } catch {
    return null;
  }
}

async function ask(facts: string, retryNote: string | null) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TAKE_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: retryNote ? `${facts}\n\n${retryNote}` : facts },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

/**
 * Up to two attempts. Returns the written take, or null with the reason when
 * both fail the number check (the email then goes without the written parts).
 */
export async function writeTake(f: Facts): Promise<{ written: Written | null; attempts: number; failure: string | null; raw: string[] }> {
  const facts = factsText(f);
  const metrics = Object.keys(f.metrics);
  const raw: string[] = [];
  let note: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await ask(facts, note);
    raw.push(reply);
    const written = parse(reply, metrics);
    if (!written) { note = "Your last reply wasn't valid JSON. Reply with the JSON object only."; continue; }
    // Only confirmed changes may appear under "changed" and "why".
    if (!Object.values(f.metrics).some((m) => m.confirmed)) { written.changed = []; written.why = null; }
    const stray = strayNumbers(written, facts);
    if (!stray.length) return { written, attempts: attempt, failure: null, raw };
    note = `Your last reply used numbers that aren't in the facts sheet: ${stray.join(", ")}. Use only numbers exactly as they appear in the facts.`;
  }
  return { written: null, attempts: 2, failure: note ?? "No valid reply", raw };
}
