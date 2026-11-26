// The new stock tables (supabase/migrations/20261124120000_stock_tables.sql).
// Runs alongside the Google Sheet: nothing here reads or writes the sheet.
import { supabase } from "@/lib/supabase";

export type ItemStatus =
  | "paid" | "in_transit" | "to_check" | "prep" | "photos" | "generate"
  | "upload" | "live" | "taken_down" | "sold"
  | "kept" | "damaged" | "lost" | "removed";

export type Source = "imported" | "online" | "donated";

export interface StockBatch {
  id: string;
  number: number;
  proxy: string;
  status: "collecting" | "shipped" | "arrived" | "checked" | "lost";
  started_on: string;
  shipped_on: string | null;
  arrived_on: string | null;
  lost_on: string | null;
  shipping_paid: number | null;
  shipping_non_gbp_fee: number | null;
  shipping_purchase_fee: number | null;
  carrier: string | null;
  tracking: string | null;
  customs: number | null;
  other_costs: number | null;
}
const BATCH_COLS = "id, number, proxy, status, started_on, shipped_on, arrived_on, lost_on, shipping_paid, shipping_non_gbp_fee, shipping_purchase_fee, carrier, tracking, customs, other_costs";

export interface StockCategory {
  id: string;
  name: string;
  sku_code: string;
  measurements: string[];
  active: boolean;
}

export interface StockItem {
  id: string;
  code: string;
  sku: string | null;
  source: Source;
  batch_id: string | null;
  name: string;
  brand: string | null;
  category_id: string | null;
  bought_on: string | null;
  link: string | null;
  notes: string | null;
  date_added: string | null;
  floor_price: number | null;
  /** What the bank charged for it in £ (the purchase line), not the price shown on the site. */
  paid: number | null;
  /** The bank's "non-GBP" fee line (2.99%). */
  non_gbp_fee: number | null;
  /** The bank's "non-GBP purchase fee" line (50p). */
  purchase_fee: number | null;
  item_cost: number | null;
  current_price: number | null;
  needs_steam: boolean; steam_done: boolean;
  needs_repair: boolean; repair_done: boolean;
  needs_measure: boolean; measure_done: boolean;
  size: string | null;
  condition: string | null;
  /** {"Pit to pit": "46", ...} in inches, as typed */
  measurements: Record<string, string>;
  kept_by: "Eryk" | "Alex" | null;
  /** Who has the piece at home (Eryk's sketch, 26 Nov). Empty until set. */
  location: "Eryk" | "Alex" | null;
  damaged_where: "warehouse" | "arrival" | null;
  refund: number | null;
  exit_date: string | null;
  status: ItemStatus;
  created_at: string;
  /** When it last changed status (from the log), for the Since column. */
  status_since: string;
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  paid: "Paid", in_transit: "In transit", to_check: "To check", prep: "Prep", photos: "Photos",
  generate: "Generate", upload: "Upload", live: "Live", taken_down: "Taken down", sold: "Sold",
  kept: "Kept", damaged: "Damaged", lost: "Lost", removed: "Removed",
};

// Colours from the mockup (the Analytics palette).
export const STATUS_COLOUR: Record<ItemStatus, string> = {
  paid: "#8a8f98", in_transit: "#2bb3c0", to_check: "#e8c547", prep: "#d55181", photos: "#3987e5",
  generate: "#9085e9", upload: "#d95926", live: "#199e70", taken_down: "#e66767", sold: "#c9c9c9",
  kept: "#c9c9c9", damaged: "#c9c9c9", lost: "#c9c9c9", removed: "#c9c9c9",
};

export const EXITS: ItemStatus[] = ["sold", "kept", "damaged", "lost", "removed"];

// The filter line, in the mockup's order. Upload also holds Taken down.
export const GROUPS = [
  { key: "Live", colour: STATUS_COLOUR.live, statuses: ["live"] },
  { key: "Orders", colour: STATUS_COLOUR.paid, statuses: ["paid", "in_transit", "to_check"] },
  { key: "Prep", colour: STATUS_COLOUR.prep, statuses: ["prep"] },
  { key: "Photos", colour: STATUS_COLOUR.photos, statuses: ["photos"] },
  { key: "Generate", colour: STATUS_COLOUR.generate, statuses: ["generate"] },
  { key: "Upload", colour: STATUS_COLOUR.upload, statuses: ["upload", "taken_down"] },
  { key: "Sold", colour: STATUS_COLOUR.sold, statuses: ["sold"] },
] as const satisfies readonly { key: string; colour: string; statuses: ItemStatus[] }[];
export type GroupKey = (typeof GROUPS)[number]["key"];

/** In stock = from arrival until it leaves (not while paid or in transit). */
/** Physically with Eryk or Alex: arrived and checked, not yet gone. Location shows only for these. */
export const atHome = (it: StockItem) => !["paid", "in_transit", "to_check"].includes(it.status) && !EXITS.includes(it.status);

export const inStock = (it: StockItem) => !["paid", "in_transit"].includes(it.status) && !EXITS.includes(it.status);

// One colour per batch number, cycling (the mockup's batch pills).
const BATCH_COLOURS = ["#c4a46a", "#a3d36a", "#e8955a", "#5fb7e8", "#e87ab0", "#7c8cf0"];
export const batchColour = (n: number) => BATCH_COLOURS[(n - 1) % BATCH_COLOURS.length];

export const gbp = (n: number) => `£${n.toFixed(2)}`;

export interface StockData {
  items: StockItem[];
  batches: StockBatch[];
  categories: StockCategory[];
  settings: { floorMarkup: number; conditions: string[] };
}

export async function loadStock(): Promise<StockData> {
  const [items, batches, categories, log, settings] = await Promise.all([
    supabase.from("stock_items").select("id, code, sku, source, batch_id, name, brand, category_id, bought_on, link, notes, date_added, floor_price, paid, non_gbp_fee, purchase_fee, item_cost, current_price, status, created_at, needs_steam, steam_done, needs_repair, repair_done, needs_measure, measure_done, size, condition, measurements, kept_by, location, damaged_where, refund, exit_date").order("created_at", { ascending: false }),
    supabase.from("stock_batches").select(BATCH_COLS).order("number"),
    supabase.from("stock_categories").select("id, name, sku_code, measurements, active").order("name"),
    supabase.from("stock_log").select("item_id, created_at").eq("what", "status").not("item_id", "is", null).order("created_at", { ascending: false }),
    supabase.from("stock_settings").select("key, value").in("key", ["floor_markup", "conditions"]),
  ]);
  const err = items.error || batches.error || categories.error || log.error || settings.error;
  if (err) throw err;

  const lastChange = new Map<string, string>();
  for (const l of log.data ?? []) if (!lastChange.has(l.item_id)) lastChange.set(l.item_id, l.created_at);

  return {
    items: (items.data ?? []).map((it) => ({ ...it, status_since: lastChange.get(it.id) ?? it.created_at }) as StockItem),
    batches: (batches.data ?? []) as StockBatch[],
    categories: (categories.data ?? []) as StockCategory[],
    settings: {
      floorMarkup: Number(settings.data?.find((r) => r.key === "floor_markup")?.value ?? 0.3),
      conditions: (settings.data?.find((r) => r.key === "conditions")?.value as string[]) ?? ["New with tags", "Like new", "Very good", "Good"],
    },
  };
}

/** The batch that's collecting; opens Batch 1 (or the next number) if there isn't one. */
export async function collectingBatch(): Promise<StockBatch> {
  const { data, error } = await supabase.from("stock_batches").select(BATCH_COLS)
    .eq("status", "collecting").order("number").limit(1).maybeSingle();
  if (error) throw error;
  if (data) return data as StockBatch;

  const { data: last } = await supabase.from("stock_batches").select("number").order("number", { ascending: false }).limit(1).maybeSingle();
  const { data: made, error: makeErr } = await supabase.from("stock_batches")
    .insert({ number: (last?.number ?? 0) + 1 }).select(BATCH_COLS).single();
  if (makeErr) {
    // Someone else opened it at the same moment: use theirs.
    if (makeErr.code === "23505") return collectingBatch();
    throw makeErr;
  }
  return made as StockBatch;
}

export interface NewItem {
  source: Source;
  name: string;
  brand: string;
  category_id: string | null;
  // Imported
  paid?: number | null;
  non_gbp_fee?: number | null;
  purchase_fee?: number | null;
  bought_on?: string;
  link?: string;
  // Bought online
  item_cost?: number | null;
  // Bought online / donated
  needs?: { steam: boolean; repair: boolean; measure: boolean };
}

const today = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local

/** Saves one item and returns its new code (1-001, O-001, D-001). */
export async function addItem(n: NewItem): Promise<string> {
  const batch = n.source === "imported" ? await collectingBatch() : null;
  const prefix = batch ? `${batch.number}-` : n.source === "online" ? "O-" : "D-";
  const { data: code, error: codeErr } = await supabase.rpc("stock_next_code", { prefix });
  if (codeErr || !code) throw codeErr ?? new Error("Couldn't get the next code.");

  const blank = (s?: string) => (s && s.trim() ? s.trim() : null);
  const row = n.source === "imported"
    ? { status: "paid", batch_id: batch!.id, paid: n.paid ?? null, non_gbp_fee: n.non_gbp_fee ?? null, purchase_fee: n.purchase_fee ?? null, bought_on: blank(n.bought_on), link: blank(n.link) }
    : {
        status: "prep",
        item_cost: n.source === "donated" ? 0 : n.item_cost ?? null,
        bought_on: n.source === "online" ? blank(n.bought_on) : null,
        date_added: today(),
        needs_steam: !!n.needs?.steam, needs_repair: !!n.needs?.repair, needs_measure: !!n.needs?.measure,
      };

  const { error } = await supabase.from("stock_items").insert({
    code, source: n.source, name: n.name.trim(), brand: blank(n.brand), category_id: n.category_id, ...row,
  });
  if (error) throw error;
  return code as string;
}

// ---------- batches ----------

/** What a batch has cost so far: what was paid for its items and their bank fees, plus shipping and its fees once shipped. */
export function batchTotals(b: StockBatch, items: StockItem[]) {
  const its = items.filter((i) => i.batch_id === b.id);
  const sum = (f: (i: StockItem) => number | null) => its.reduce((a, i) => a + (f(i) ?? 0), 0);
  const prices = sum((i) => i.paid), nonGbpFees = sum((i) => i.non_gbp_fee), purchaseFees = sum((i) => i.purchase_fee);
  const bankFees = nonGbpFees + purchaseFees;
  const shipping = (b.shipping_paid ?? 0) + (b.shipping_non_gbp_fee ?? 0) + (b.shipping_purchase_fee ?? 0);
  return { count: its.length, prices, nonGbpFees, purchaseFees, total: prices + bankFees + shipping };
}

/** The date a batch's current status started (for the Since column). */
export const batchSince = (b: StockBatch) =>
  (b.status === "lost" ? b.lost_on : b.status === "collecting" ? b.started_on : b.status === "shipped" ? b.shipped_on : b.arrived_on) ?? b.started_on;

/** A tracking page that works for any carrier. */
export const trackingUrl = (tracking: string) => `https://t.17track.net/en#nums=${encodeURIComponent(tracking.trim())}`;

export interface ShipForm {
  shipped_on: string;
  carrier: string;
  shipping_paid: number | null;
  shipping_non_gbp_fee: number | null;
  shipping_purchase_fee: number | null;
  tracking: string;
}

/** Ship: the batch is shipped, its items go In transit, and the next batch starts collecting. */
export async function shipBatch(b: StockBatch, f: ShipForm): Promise<number> {
  const blank = (s: string) => (s.trim() ? s.trim() : null);
  const { error } = await supabase.from("stock_batches").update({
    status: "shipped", shipped_on: f.shipped_on, carrier: blank(f.carrier), tracking: blank(f.tracking),
    shipping_paid: f.shipping_paid, shipping_non_gbp_fee: f.shipping_non_gbp_fee, shipping_purchase_fee: f.shipping_purchase_fee,
  }).eq("id", b.id).eq("status", "collecting");
  if (error) throw error;
  const { error: itemsErr } = await supabase.from("stock_items").update({ status: "in_transit" }).eq("batch_id", b.id).eq("status", "paid");
  if (itemsErr) throw itemsErr;
  const next = await collectingBatch();
  return next.number;
}

// ---------- items ----------

export async function saveNotes(itemId: string, notes: string) {
  const { error } = await supabase.from("stock_items").update({ notes: notes.trim() ? notes : null }).eq("id", itemId);
  if (error) throw error;
}

export interface LogEntry { what: string; from_value: string | null; to_value: string | null; who: string; note: string | null; created_at: string }

export async function itemHistory(itemId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase.from("stock_log").select("what, from_value, to_value, who, note, created_at")
    .eq("item_id", itemId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LogEntry[];
}

const FIELD_LABEL: Record<string, string> = {
  status: "Status", notes: "Notes", name: "Name", brand: "Brand", category_id: "Category", paid: "Paid",
  non_gbp_fee: "Non-GBP fee", purchase_fee: "Purchase fee", item_cost: "Item cost", floor_price: "Floor price", bought_on: "Bought on", link: "Link",
  batch_id: "Batch", needs_steam: "Needs steam", needs_repair: "Needs repair", needs_measure: "Needs measuring",
  steam_done: "Steamed", repair_done: "Repaired", measure_done: "Measured", size: "Size", condition: "Condition",
  measurements: "Measurements", kept_by: "Kept by", location: "Location", refund: "Refund", customs: "Customs", other_costs: "Other costs",
};

/** One history line in plain words, e.g. "Paid → In transit". */
export function logLine(e: LogEntry): string {
  if (e.what === "created") return "Added";
  if (e.what === "sale.created") return "Sold";
  const label = FIELD_LABEL[e.what] ?? e.what.replace(/^sale\./, "Sale ").replace(/_/g, " ");
  if (e.what === "status") return `${STATUS_LABEL[e.from_value as ItemStatus] ?? e.from_value} → ${STATUS_LABEL[e.to_value as ItemStatus] ?? e.to_value}`;
  if (e.what === "notes" || e.what === "measurements") return `${label} changed`;
  if (e.to_value === "true" || e.to_value === "false") return `${label}: ${e.to_value === "true" ? "yes" : "no"}`;
  if (e.from_value == null) return `${label} set to ${e.to_value}`;
  if (e.to_value == null) return `${label} cleared`;
  return `${label}: ${e.from_value} → ${e.to_value}`;
}

// ---------- arrival and check ----------

export interface ArriveForm { arrived_on: string; customs: number | null; other_costs: number | null }

/** Arrived: the batch gets its arrival date and any customs / other costs; its items go To check. */
export async function arriveBatch(b: StockBatch, f: ArriveForm) {
  const { error } = await supabase.from("stock_batches").update({
    status: "arrived", arrived_on: f.arrived_on, customs: f.customs, other_costs: f.other_costs,
  }).eq("id", b.id).eq("status", "shipped");
  if (error) throw error;
  const { error: itemsErr } = await supabase.from("stock_items").update({ status: "to_check" }).eq("batch_id", b.id).eq("status", "in_transit");
  if (itemsErr) throw itemsErr;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Each item's final cost: what was paid + its two bank fees + its share of the batch's
 * shipping, shipping fees, customs and other costs, shared by what was paid (as the sheet does).
 * Items damaged at the warehouse never shipped, so they take no share.
 */
export function landedCosts(b: StockBatch, items: StockItem[], floorMarkup: number) {
  const shipped = items.filter((i) => i.batch_id === b.id && i.damaged_where !== "warehouse");
  const base = shipped.reduce((a, i) => a + (i.paid ?? 0), 0);
  const extras = (b.shipping_paid ?? 0) + (b.shipping_non_gbp_fee ?? 0) + (b.shipping_purchase_fee ?? 0) + (b.customs ?? 0) + (b.other_costs ?? 0);
  const out = new Map<string, { item_cost: number; floor_price: number }>();
  for (const i of shipped) {
    const own = (i.paid ?? 0) + (i.non_gbp_fee ?? 0) + (i.purchase_fee ?? 0);
    const cost = r2(own + (base > 0 ? extras * (i.paid ?? 0) / base : 0));
    out.set(i.id, { item_cost: cost, floor_price: r2(cost * (1 + floorMarkup)) });
  }
  return out;
}

export type Needs = { steam: boolean; repair: boolean; measure: boolean };
export type CheckOutcome =
  | { out: "ready"; needs: Needs }
  | { out: "kept"; by: "Eryk" | "Alex" }
  | { out: "damaged"; refund: number | null };

/** Prep if anything needs doing, otherwise straight to Photos. */
export const afterReady = (n: Needs): ItemStatus => (n.steam || n.repair || n.measure ? "prep" : "photos");

/**
 * The arrival check for one or more items of a batch. Sets each item's final cost (and floor price),
 * then Ready → Prep (or Photos), Kept → out of stock with who kept it, Damaged → out of stock with any refund.
 * The batch turns Checked once none of its items are left to check.
 */
export async function checkItems(b: StockBatch, data: StockData, outcomes: Map<string, CheckOutcome>) {
  const costs = landedCosts(b, data.items, data.settings.floorMarkup);
  const day = new Date().toLocaleDateString("en-CA");
  for (const [id, o] of outcomes) {
    const c = costs.get(id);
    const base = { item_cost: c?.item_cost ?? null, date_added: day };
    const patch = o.out === "ready"
      ? { ...base, floor_price: c?.floor_price ?? null, status: afterReady(o.needs),
          needs_steam: o.needs.steam, needs_repair: o.needs.repair, needs_measure: o.needs.measure }
      : o.out === "kept"
        ? { ...base, status: "kept", kept_by: o.by, exit_date: day, exit_reason: "kept", invoice_paid: false }
        : { ...base, status: "damaged", damaged_where: "arrival", exit_date: day, exit_reason: "damaged", refund: o.refund };
    const { error } = await supabase.from("stock_items").update(patch).eq("id", id).eq("status", "to_check");
    if (error) throw error;
  }
  const { count, error } = await supabase.from("stock_items").select("id", { count: "exact", head: true }).eq("batch_id", b.id).eq("status", "to_check");
  if (error) throw error;
  if (!count) {
    const { error: bErr } = await supabase.from("stock_batches").update({ status: "checked" }).eq("id", b.id).eq("status", "arrived");
    if (bErr) throw bErr;
  }
}

// ---------- prep and measuring ----------

export type Job = "steam" | "repair" | "measure";

/** Tick a job done (or not). Once every job it needs is done, it moves on to Photos. */
export async function setJobDone(it: StockItem, job: Job, done: boolean): Promise<boolean> {
  const next = { steam: it.steam_done, repair: it.repair_done, measure: it.measure_done, [job]: done };
  const finished = (!it.needs_steam || next.steam) && (!it.needs_repair || next.repair) && (!it.needs_measure || next.measure)
    && (it.needs_steam || it.needs_repair || it.needs_measure || done);
  const { error } = await supabase.from("stock_items").update({
    [`${job}_done`]: done, ...(finished && it.status === "prep" ? { status: "photos" } : {}),
  }).eq("id", it.id);
  if (error) throw error;
  return finished && it.status === "prep";
}

/** Save measuring-form fields (size, condition, measurements, category, notes). */
/** Save item fields: the measuring form, and the Details pencils (name, brand, bought on, paid and its fees...). */
export async function updateItem(id: string, patch: Partial<Pick<StockItem, "size" | "condition" | "measurements" | "category_id" | "notes" | "name" | "brand" | "bought_on" | "paid" | "non_gbp_fee" | "purchase_fee" | "location">>) {
  const { error } = await supabase.from("stock_items").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- invoices ----------

/** Emails a kept item's invoice (a PDF) to whoever kept it. Returns who it went to. */
export async function sendInvoice(itemId: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/stock/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ itemId }),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.ok) throw new Error(out?.error || `Invoice not sent (${res.status})`);
  return out.to as string;
}

/** After Sort: these items' photos are in their folders, so they move on to Generate. */
export async function photosDone(itemIds: string[]) {
  if (!itemIds.length) return;
  const { error } = await supabase.from("stock_items").update({ status: "generate" }).in("id", itemIds).eq("status", "photos");
  if (error) throw error;
}
