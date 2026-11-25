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
}
const BATCH_COLS = "id, number, proxy, status, started_on, shipped_on, arrived_on, lost_on, shipping_paid, shipping_non_gbp_fee, shipping_purchase_fee, carrier, tracking";

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
export const inStock = (it: StockItem) => !["paid", "in_transit"].includes(it.status) && !EXITS.includes(it.status);

// One colour per batch number, cycling (the mockup's batch pills).
const BATCH_COLOURS = ["#c4a46a", "#a3d36a", "#e8955a", "#5fb7e8", "#e87ab0", "#7c8cf0"];
export const batchColour = (n: number) => BATCH_COLOURS[(n - 1) % BATCH_COLOURS.length];

export const gbp = (n: number) => `£${n.toFixed(2)}`;

export interface StockData {
  items: StockItem[];
  batches: StockBatch[];
  categories: StockCategory[];
}

export async function loadStock(): Promise<StockData> {
  const [items, batches, categories, log] = await Promise.all([
    supabase.from("stock_items").select("id, code, sku, source, batch_id, name, brand, category_id, bought_on, link, notes, date_added, floor_price, paid, non_gbp_fee, purchase_fee, item_cost, current_price, status, created_at").order("created_at", { ascending: false }),
    supabase.from("stock_batches").select(BATCH_COLS).order("number"),
    supabase.from("stock_categories").select("id, name, sku_code, measurements, active").order("name"),
    supabase.from("stock_log").select("item_id, created_at").eq("what", "status").not("item_id", "is", null).order("created_at", { ascending: false }),
  ]);
  const err = items.error || batches.error || categories.error || log.error;
  if (err) throw err;

  const lastChange = new Map<string, string>();
  for (const l of log.data ?? []) if (!lastChange.has(l.item_id)) lastChange.set(l.item_id, l.created_at);

  return {
    items: (items.data ?? []).map((it) => ({ ...it, status_since: lastChange.get(it.id) ?? it.created_at }) as StockItem),
    batches: (batches.data ?? []) as StockBatch[],
    categories: (categories.data ?? []) as StockCategory[],
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
  const prices = sum((i) => i.paid), bankFees = sum((i) => (i.non_gbp_fee ?? 0) + (i.purchase_fee ?? 0));
  const shipping = (b.shipping_paid ?? 0) + (b.shipping_non_gbp_fee ?? 0) + (b.shipping_purchase_fee ?? 0);
  return { count: its.length, prices, bankFees, total: prices + bankFees + shipping };
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
  batch_id: "Batch", needs_steam: "Steam", needs_repair: "Repair", needs_measure: "Measure",
};

/** One history line in plain words, e.g. "Paid → In transit". */
export function logLine(e: LogEntry): string {
  if (e.what === "created") return "Added";
  if (e.what === "sale.created") return "Sold";
  const label = FIELD_LABEL[e.what] ?? e.what.replace(/^sale\./, "Sale ").replace(/_/g, " ");
  if (e.what === "status") return `${STATUS_LABEL[e.from_value as ItemStatus] ?? e.from_value} → ${STATUS_LABEL[e.to_value as ItemStatus] ?? e.to_value}`;
  if (e.what === "notes") return "Notes changed";
  if (e.from_value == null) return `${label} set to ${e.to_value}`;
  if (e.to_value == null) return `${label} cleared`;
  return `${label}: ${e.from_value} → ${e.to_value}`;
}
