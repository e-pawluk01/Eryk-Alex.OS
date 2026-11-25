"use client";

// Batches on the Orders filter, the batch panel, and the Ship pop-up (mockup: batches(), batchSlide(), modal 'ship').
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Ship, Package } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { StockBatch, StockData, batchTotals, batchSince, trackingUrl, shipBatch, gbp } from "@/lib/stock";
import { BatchPill, BatchChip, StatusChip, ModalHead, cx, dateLabel } from "./ui";
import s from "./stock.module.css";

const ACTIVE: StockBatch["status"][] = ["collecting", "shipped", "arrived"];

export function BatchList({ data, onOpen, onShip }: {
  data: StockData;
  onOpen: (b: StockBatch) => void;
  onShip: (b: StockBatch) => void;
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
        {b.status === "collecting"
          ? <button className={s.btn} onClick={(e) => { e.stopPropagation(); onShip(b); }}>Ship</button>
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

export function BatchPanel({ batch, data, onClose, onOpenItem, onShip }: {
  batch: StockBatch;
  data: StockData;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  onShip: (b: StockBatch) => void;
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
        {batch.status === "collecting" && (
          <div className={s.foot}><button className={s.btn} onClick={() => onShip(batch)}>Ship</button></div>
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
      <div className={cx(s.modal, s.gapsm)} role="dialog" aria-modal="true" aria-label={`Ship batch ${batch.number}`}>
        <ModalHead title={`Ship batch ${batch.number}`} onClose={onClose} />
        <div className={s.g2}>
          <label className={s.fi}><span>Shipped</span><input className={s.inp} type="date" value={f.shipped_on} onChange={set("shipped_on")} aria-label="Ship date" /></label>
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
