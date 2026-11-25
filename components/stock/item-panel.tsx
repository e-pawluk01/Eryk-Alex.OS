"use client";

// The item panel (mockup: slide()). Built so far for orders: Paid and In transit.
// Tabs: Overview (what's next + notes + price strip), Photos, Details (+ history).
import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Ship, Truck, Package, Tag, History, Camera } from "lucide-react";
import { StockData, StockItem, LogEntry, saveNotes, itemHistory, logLine, trackingUrl, gbp } from "@/lib/stock";
import { StatusChip, BatchPill, FloorIcon, cx, dateLabel } from "./ui";
import s from "./stock.module.css";

type Tab = "overview" | "photos" | "details";

export function ItemPanel({ item, data, onClose }: { item: StockItem; data: StockData; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<LogEntry[] | null>(null);
  const batch = item.batch_id ? data.batches.find((b) => b.id === item.batch_id) : undefined;
  const category = data.categories.find((c) => c.id === item.category_id)?.name;
  const isOrder = ["paid", "in_transit", "to_check"].includes(item.status);

  useEffect(() => { setNotes(item.notes ?? ""); }, [item.id, item.notes]);
  useEffect(() => { setTab("overview"); setHistOpen(false); setHist(null); }, [item.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openHistory = async () => {
    const open = !histOpen;
    setHistOpen(open);
    if (open) { try { setHist(await itemHistory(item.id)); } catch { setHist([]); } }
  };
  const saveNotesIfChanged = () => { if (notes !== (item.notes ?? "")) saveNotes(item.id, notes).catch(() => {}); };

  // The headline: an order shows its rough price so far (site price + bank fee), marked "~".
  const rough = (item.site_price ?? 0) + (item.bank_fee ?? 0);
  const headline = isOrder && (item.site_price != null || item.bank_fee != null)
    ? <span className={s.hl}><b className={s.muted}>{item.item_cost != null ? gbp(item.item_cost) : "~" + gbp(rough)}</b></span>
    : null;

  const row = (k: string, v: string | null | undefined) => (v === null || v === undefined || v === "") ? null : <div className={s.kvr}><span>{k}</span><span>{v}</span></div>;
  const group = (title: string, rows: (React.ReactNode | null)[]) => rows.some(Boolean) ? <div className={s.kvg}><span className={s.lbl}>{title}</span>{rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)}</div> : null;

  const cells: [React.ReactNode, string, string][] = [
    [<Package key="i" className="w-4 h-4" />, "Final landing cost", item.item_cost != null && !isOrder ? gbp(item.item_cost) : "—"],
    [<Tag key="i" className="w-4 h-4" />, "Item's price", item.source === "imported" ? (item.site_price != null ? gbp(item.site_price) : "—") : (item.item_cost != null ? gbp(item.item_cost) : "—")],
    [<FloorIcon key="i" />, "Floor price", item.floor_price != null && !isOrder ? gbp(item.floor_price) : "—"],
    [<Calendar key="i" className="w-4 h-4" />, "Date added", item.date_added ? dateLabel(item.date_added) : "—"],
  ];

  return createPortal(
    <div className={s.root}>
      <div className={s.pscrim} onClick={onClose} />
      <aside className={s.slide} role="dialog" aria-modal="true" aria-label="Item">
        <div className={s.shead}>
          <div className={s.idrow}>
            <span className={s.mono}>{item.code}{item.sku ? ` · ${item.sku}` : ""}</span><span style={{ flex: 1 }} />
            <button className={s.x} onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className={s.sbody}>
          <div className={s.ptop}><span className={s.pname}>{item.name}</span>{headline}</div>
          <div className={s.liverow}>
            <StatusChip status={item.status} />
            {isOrder && batch && <BatchPill n={batch.number} label={`Batch ${batch.number}`} />}
          </div>
          <div className={s.ptabs} role="tablist">
            {(["overview", "photos", "details"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {tab === "overview" ? (
            <>
              {item.status === "in_transit" && batch && (batch.shipped_on || batch.carrier) && (
                <div className={s.ov}>
                  {batch.shipped_on && <div className={s.irow}><Ship className="w-4 h-4" /><span>{dateLabel(batch.shipped_on)}</span></div>}
                  {batch.carrier && <div className={s.irow}><Truck className="w-4 h-4" /><span>{batch.carrier}</span></div>}
                </div>
              )}
              <label className={s.notes}>
                <span className={s.lbl}>Notes</span>
                <textarea className={s.inp} rows={3} aria-label="Notes" value={notes}
                  onChange={(e) => setNotes(e.target.value)} onBlur={saveNotesIfChanged} />
              </label>
              <div className={s.strip}>
                {cells.map(([ic, t, v]) => <div key={t} title={t}>{ic}<span className={s.sr}>{t}</span><span>{v}</span></div>)}
              </div>
            </>
          ) : tab === "photos" ? (
            <div className={s.empty2}>
              <span className={s.eic}><Camera className="w-[22px] h-[22px]" /></span>
              <span className={s.et}>No photos yet</span>
              <span className={s.sub}>AirDrop them to the Mac, then sort them in the photo inbox.</span>
            </div>
          ) : (
            <div className={s.kvwrap}>
              {item.source === "imported" && group("Order", [
                row("Batch", batch ? String(batch.number) : null), row("Proxy", batch?.proxy), row("Bought on", item.bought_on),
                row("Site price", item.site_price != null ? gbp(item.site_price) : null), row("Bank fee", item.bank_fee != null ? gbp(item.bank_fee) : null),
              ])}
              {group("Dates", [row("Added", item.date_added ? dateLabel(item.date_added) : null)])}
              {group("Item", [
                row("Category", category), row("Brand", item.brand),
                item.source === "imported" ? null : row("Sourced from", item.bought_on),
              ])}
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className={s.histbtn} onClick={openHistory} aria-expanded={histOpen} aria-label="History" title="History"><History className="w-5 h-5" /></button>
                </div>
                {histOpen && (
                  <div>
                    {!hist ? <div className={s.hist}><span className={s.hd}>Loading…</span></div>
                      : hist.map((h, i) => (
                        <div key={i} className={s.hist}>
                          <span className={s.hd}>{new Date(h.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{logLine(h)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {item.status === "in_transit" && batch?.tracking && (
          <div className={s.foot}>
            <a className={cx(s.btn)} href={trackingUrl(batch.tracking)} target="_blank" rel="noreferrer">Track parcel ↗</a>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
