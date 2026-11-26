"use client";

// Batches on the Orders filter, the batch panel, and the Ship pop-up (mockup: batches(), batchSlide(), modal 'ship').
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Ship, Package, PackageX, Undo2, Wind, Scissors, Ruler } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { StockBatch, StockData, StockItem, batchTotals, batchSince, trackingUrl, shipBatch, arriveBatch, checkItems, CheckOutcome, Needs, gbp, sendInvoice } from "@/lib/stock";
import { BatchPill, BatchChip, StatusChip, ModalHead, cx, dateLabel } from "./ui";
import { DatePicker } from "@/components/ui/date-picker";
import s from "./stock.module.css";

const ACTIVE: StockBatch["status"][] = ["collecting", "shipped", "arrived"];

/** The one thing to do next with a batch (mockup bAct): Ship, then Arrived, then Check. */
export const batchAction = (b: StockBatch) =>
  b.status === "collecting" ? "Ship" : b.status === "shipped" ? "Arrived" : b.status === "arrived" ? "Check" : null;

export function BatchList({ data, onOpen, onAction }: {
  data: StockData;
  onOpen: (b: StockBatch) => void;
  onAction: (b: StockBatch) => void;
}) {
  const today = new Date();
  const row = (b: StockBatch) => {
    const t = batchTotals(b, data.items);
    return (
      <div key={b.id} className={cx(s.brow2, s.click)} role="button" tabIndex={0} aria-label={`Batch ${b.number}`}
        onClick={() => onOpen(b)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(b); }}>
        <span><BatchPill n={b.number} /></span>
        <BatchChip status={b.status} />
        <span className={s.sub}>{t.count}</span>
        <span className={s.pr}>{gbp(t.total)}</span>
        <span className={s.sub}>{differenceInCalendarDays(today, parseISO(batchSince(b)))}d</span>
        {batchAction(b)
          ? <button className={s.btn} onClick={(e) => { e.stopPropagation(); onAction(b); }}>{batchAction(b)}</button>
          : <span />}
      </div>
    );
  };
  const section = (label: string, bs: StockBatch[]) => bs.length ? (
    <div className={s.bsec}>
      <span className={s.lbl}>{label}</span>
      <div className={s.list}>
        <div className={cx(s.brow2, s.bh)}>
          <span className={s.lbl}>Batch</span><span className={s.lbl}>Status</span><span className={s.lbl}>Items</span>
          <span className={s.lbl}>Total</span><span className={s.lbl}>Since</span><span />
        </div>
        {bs.map(row)}
      </div>
    </div>
  ) : null;
  const newestFirst = [...data.batches].sort((a, b) => b.number - a.number);
  return (
    <>
      {section("Batches", newestFirst.filter((b) => ACTIVE.includes(b.status)))}
      {section("Previous", newestFirst.filter((b) => !ACTIVE.includes(b.status)))}
    </>
  );
}

export function BatchPanel({ batch, data, onClose, onOpenItem, onAction }: {
  batch: StockBatch;
  data: StockData;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  onAction: (b: StockBatch) => void;
}) {
  const t = batchTotals(batch, data.items);
  const its = data.items.filter((i) => i.batch_id === batch.id).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const shipped = batch.status !== "collecting";
  const row = (k: string, v: React.ReactNode) => <div className={s.kvr}><span>{k}</span><span>{v}</span></div>;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className={s.root}>
      <div className={s.pscrim} onClick={onClose} />
      <aside className={s.slide} role="dialog" aria-modal="true" aria-label={`Batch ${batch.number}`}>
        <div className={s.shead}>
          <div className={s.idrow}>
            <span className={s.mono}>{batch.proxy}</span><span style={{ flex: 1 }} />
            <button className={s.x} onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className={s.sbody}>
          <div className={s.ptop}><span className={s.pname}>Batch {batch.number}</span><span className={s.hl}><b>{gbp(t.total)}</b> total</span></div>
          <div className={s.liverow}><BatchChip status={batch.status} /></div>
          <div className={s.ov} style={{ gap: 14 }}>
            <div className={s.irow}><Calendar className="w-4 h-4" /><span>Started {dateLabel(batch.started_on)}</span></div>
            {batch.shipped_on && <div className={s.irow}><Ship className="w-4 h-4" /><span>Shipped {dateLabel(batch.shipped_on)}</span></div>}
            {batch.arrived_on && <div className={s.irow}><Package className="w-4 h-4" /><span>Arrived {dateLabel(batch.arrived_on)}</span></div>}
          </div>
          <div className={s.kvg}>
            <span className={s.lbl}>Costs</span>
            {row("Items", gbp(t.prices))}
            {/* The bank's lines, never merged (Eryk, 25 Nov). */}
            {row("Non-GBP fees", gbp(t.nonGbpFees))}
            {row("Purchase fees", gbp(t.purchaseFees))}
            {shipped && row("Shipping", gbp(batch.shipping_paid ?? 0))}
            {shipped && row("Shipping non-GBP fee", gbp(batch.shipping_non_gbp_fee ?? 0))}
            {shipped && row("Shipping purchase fee", gbp(batch.shipping_purchase_fee ?? 0))}
            {batch.arrived_on && row("Customs", gbp(batch.customs ?? 0))}
            {batch.arrived_on && row("Other costs", gbp(batch.other_costs ?? 0))}
          </div>
          {shipped && (batch.carrier || batch.tracking) && (
            <div className={s.kvg}>
              <span className={s.lbl}>Parcel</span>
              {batch.carrier && row("Courier", batch.carrier)}
              {batch.tracking && row("Tracking", <a href={trackingUrl(batch.tracking)} target="_blank" rel="noreferrer">{batch.tracking} ↗</a>)}
            </div>
          )}
          {its.length > 0 && (
            <div className={s.kvg}>
              <span className={s.lbl}>Items · {its.length}</span>
              {its.map((i) => (
                <button key={i.id} className={s.bitem} onClick={() => onOpenItem(i.id)}>
                  <span className={s.mono}>{i.code}</span><span className={s.bn}>{i.name}</span><StatusChip status={i.status} />
                </button>
              ))}
            </div>
          )}
        </div>
        {batchAction(batch) && (
          <div className={s.foot}><button className={s.btn} onClick={() => onAction(batch)}>{batchAction(batch)}</button></div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

const todayIso = () => new Date().toLocaleDateString("en-CA");
const money = (v: string) => { const n = parseFloat(v.replace(/[£,\s]/g, "")); return Number.isFinite(n) ? n : null; };

export function ShipDialog({ batch, onClose, onShipped }: {
  batch: StockBatch;
  onClose: () => void;
  onShipped: (next: number) => void;
}) {
  const [f, setF] = useState({ shipped_on: todayIso(), carrier: "", shipping_paid: "", shipping_non_gbp_fee: "", shipping_purchase_fee: "", tracking: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (saving || !f.shipped_on) return;
    setSaving(true);
    setError(null);
    try {
      const next = await shipBatch(batch, {
        shipped_on: f.shipped_on, carrier: f.carrier, tracking: f.tracking,
        shipping_paid: money(f.shipping_paid), shipping_non_gbp_fee: money(f.shipping_non_gbp_fee), shipping_purchase_fee: money(f.shipping_purchase_fee),
      });
      onShipped(next);
    } catch (e: any) {
      setError(e?.message || "Couldn't save it.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} style={{ zIndex: 100 }} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm, s.ovis)} role="dialog" aria-modal="true" aria-label={`Ship batch ${batch.number}`}>
        <ModalHead title={`Ship batch ${batch.number}`} onClose={onClose} />
        <div className={s.g2}>
          <div className={s.fi}><span>Shipped</span><div className={s.dp}><DatePicker value={f.shipped_on || null} onChange={(d) => setF((p) => ({ ...p, shipped_on: d ?? "" }))} placeholder="Pick a date" /></div></div>
          <label className={s.fi}><span>Carrier</span><input className={s.inp} value={f.carrier} onChange={set("carrier")} aria-label="Carrier" /></label>
        </div>
        {/* The bank's three lines for the shipping payment: the charge, then its two fees. */}
        <label className={s.fi}><span>Shipping £</span><input className={s.inp} inputMode="decimal" value={f.shipping_paid} onChange={set("shipping_paid")} aria-label="Shipping paid" /></label>
        <div className={s.g2}>
          <label className={s.fi}><span>Non-GBP fee £</span><input className={s.inp} inputMode="decimal" value={f.shipping_non_gbp_fee} onChange={set("shipping_non_gbp_fee")} aria-label="Shipping non-GBP fee" /></label>
          <label className={s.fi}><span>Purchase fee £</span><input className={s.inp} inputMode="decimal" value={f.shipping_purchase_fee} onChange={set("shipping_purchase_fee")} aria-label="Shipping non-GBP purchase fee" /></label>
        </div>
        <label className={s.fi}><span>Tracking</span><input className={s.inp} value={f.tracking} onChange={set("tracking")} aria-label="Tracking number" /></label>
        {error && <div className={s.err}>{error}</div>}
        <button className={s.btnw} disabled={saving || !f.shipped_on} onClick={save}>Save</button>
      </div>
    </div>,
    document.body,
  );
}

/** Arrived (mockup 'arrive'): arrival date, customs, other costs. Its items go To check. */
export function ArriveDialog({ batch, onClose, onArrived }: {
  batch: StockBatch;
  onClose: () => void;
  onArrived: () => void;
}) {
  const [f, setF] = useState({ arrived_on: todayIso(), customs: "", other_costs: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  useEscape(onClose);

  const save = async () => {
    if (saving || !f.arrived_on) return;
    setSaving(true);
    setError(null);
    try {
      await arriveBatch(batch, { arrived_on: f.arrived_on, customs: money(f.customs), other_costs: money(f.other_costs) });
      onArrived();
    } catch (e: any) {
      setError(e?.message || "Couldn't save it.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm, s.ovis)} role="dialog" aria-modal="true" aria-label={`Batch ${batch.number} arrived`}>
        <ModalHead title={`Batch ${batch.number} arrived`} onClose={onClose} />
        <div className={s.fi}><span>Arrived</span><div className={s.dp}><DatePicker value={f.arrived_on || null} onChange={(d) => setF((p) => ({ ...p, arrived_on: d ?? "" }))} placeholder="Pick a date" /></div></div>
        <div className={s.g2}>
          <label className={s.fi}><span>Customs £</span><input className={s.inp} inputMode="decimal" value={f.customs} onChange={set("customs")} aria-label="Customs" /></label>
          <label className={s.fi}><span>Other £</span><input className={s.inp} inputMode="decimal" value={f.other_costs} onChange={set("other_costs")} aria-label="Other costs" /></label>
        </div>
        {error && <div className={s.err}>{error}</div>}
        <button className={s.btnw} disabled={saving || !f.arrived_on} onClick={save}>Save</button>
      </div>
    </div>,
    document.body,
  );
}

type Draft = { out?: "ready" | "kept" | "damaged"; needs: Needs; by: "Eryk" | "Alex" | null; refund: string };
const NEED_TICKS = [
  { key: "steam", label: "Steam", Icon: Wind },
  { key: "repair", label: "Repair", Icon: Scissors },
  { key: "measure", label: "Measure", Icon: Ruler },
] as const;

/** The three icon ticks (Steam · Repair · Measure), as in Add stock. */
export function NeedTicks({ value, onChange, small }: { value: Needs; onChange: (n: Needs) => void; small?: boolean }) {
  return (
    <div className={cx(s.jobs, small && s.jobsSm)}>
      {NEED_TICKS.map(({ key, label, Icon }) => (
        <button key={key} type="button" className={s.tick} aria-pressed={value[key]} aria-label={label} title={label}
          onClick={() => onChange({ ...value, [key]: !value[key] })}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={2} /><span className={s.box} />
        </button>
      ))}
    </div>
  );
}

/** The whole-batch arrival check (mockup 'check'): All ready in one tap, then the exceptions. */
export function CheckDialog({ batch, data, onClose, onSaved }: {
  batch: StockBatch;
  data: StockData;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const its: StockItem[] = data.items.filter((i) => i.batch_id === batch.id && i.status === "to_check")
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  // Measure is ticked by default; who kept it has to be picked (Eryk, 26 Nov).
  const blank: Draft = { needs: { steam: false, repair: false, measure: true }, by: null, refund: "" };
  const [d, setD] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const get = (id: string) => d[id] ?? blank;
  const put = (id: string, patch: Partial<Draft>) => setD((p) => ({ ...p, [id]: { ...(p[id] ?? blank), ...patch } }));
  // Checked = an outcome, and for Kept also who kept it.
  const done = its.filter((i) => { const x = get(i.id); return x.out && (x.out !== "kept" || x.by); }).length;
  useEscape(onClose);

  const save = async () => {
    if (saving || done < its.length) return;
    setSaving(true);
    setError(null);
    try {
      const outcomes = new Map<string, CheckOutcome>(its.map((i) => {
        const x = get(i.id);
        return [i.id, x.out === "ready" ? { out: "ready", needs: x.needs } : x.out === "kept" ? { out: "kept", by: x.by! } : { out: "damaged", refund: money(x.refund) }];
      }));
      await checkItems(batch, data, outcomes);
      // Kept items: email each one's invoice (a PDF) to whoever kept it.
      const kept = its.filter((i) => get(i.id).out === "kept");
      const failed: string[] = [];
      for (const i of kept) { try { await sendInvoice(i.id); } catch { failed.push(i.code); } }
      onSaved(`Check saved. Costs and floor prices final${kept.length ? ` · invoice emailed for ${kept.length - failed.length} kept` : ""}${failed.length ? ` · not sent: ${failed.join(", ")}` : ""}`);
    } catch (e: any) {
      setError(e?.message || "Couldn't save it.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      {/* Compact (Eryk's sketch, 26 Nov; mockup v127): one fixed-height row per item. Before choosing: Ready | Kept and a
          small Damaged icon. After: a pill of the choice by the name, its follow-up on the right, and a back button.
          One fixed size and fixed rows, so nothing moves. */}
      <div className={cx(s.modal, s.gapsm, s.wide, s.chkm)} role="dialog" aria-modal="true" aria-label={`Batch ${batch.number} arrival check`}>
        <ModalHead title={`Batch ${batch.number} · arrival check`} onClose={onClose} />
        <div className={s.chkhead}>
          <span className={s.chip} style={{ "--c": "#8a8f98" } as React.CSSProperties}>{done} of {its.length} checked</span>
          <button className={cx(s.btn, s.sm)} onClick={() => setD((p) => Object.fromEntries(its.map((i) => [i.id, { ...(p[i.id] ?? blank), out: p[i.id]?.out ?? "ready" }])))}>All ready</button>
        </div>
        <div className={cx(s.chklist, s.fill)}>
          {its.map((i) => {
            const x = get(i.id);
            return (
              <div key={i.id} className={s.ckrow}>
                <span className={s.mono}>{i.code}</span>
                <span className={s.ckn}>
                  <span className={s.bn}>{i.name}</span>
                  {x.out === "ready" && <span className={s.chip} style={{ "--c": "#8a8f98" } as React.CSSProperties}>Ready</span>}
                  {x.out === "kept" && <StatusChip status="kept" />}
                  {x.out === "damaged" && <span className={s.dmgi} title="Damaged" aria-label="Damaged"><PackageX className="w-4 h-4" /></span>}
                </span>
                <span className={s.ckr}>
                  {!x.out ? (
                    <>
                      <div className={s.seg} role="group" aria-label={`Outcome for ${i.name}`}>
                        <button onClick={() => put(i.id, { out: "ready" })}>Ready</button>
                        <button onClick={() => put(i.id, { out: "kept" })}>Kept</button>
                      </div>
                      <button className={s.ckb} onClick={() => put(i.id, { out: "damaged" })} aria-label="Damaged" title="Damaged"><PackageX className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      {x.out === "ready" && <NeedTicks value={x.needs} onChange={(n) => put(i.id, { needs: n })} small />}
                      {x.out === "kept" && (
                        // Same tick boxes as Steam / Repair / Measure; one of the two.
                        <div className={cx(s.jobs, s.jobsSm)} role="radiogroup" aria-label="Kept by">
                          {(["Eryk", "Alex"] as const).map((w) => (
                            <button key={w} type="button" role="radio" aria-checked={x.by === w} aria-pressed={x.by === w} className={s.tick} onClick={() => put(i.id, { by: w })}>
                              {w}<span className={s.box} />
                            </button>
                          ))}
                        </div>
                      )}
                      {x.out === "damaged" && (
                        <label className={cx(s.fi, s.ckref)}><span>Refund £</span><input className={s.inp} inputMode="decimal" value={x.refund} onChange={(e) => put(i.id, { refund: e.target.value })} aria-label="Refund" /></label>
                      )}
                      <button className={s.ckb} onClick={() => put(i.id, { out: undefined })} aria-label="Back" title="Back"><Undo2 className="w-[15px] h-[15px]" /></button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {error && <div className={s.err}>{error}</div>}
        <button className={s.btnw} disabled={saving || done < its.length} onClick={save}>Save</button>
      </div>
    </div>,
    document.body,
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
