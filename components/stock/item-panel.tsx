"use client";

// The item panel (mockup: slide()). Built so far: Paid, In transit, To check (Damaged / Kept / Ready),
// Prep (job ticks + measuring form) and Photos. Tabs: Overview, Photos, Details (+ history).
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Ship, Truck, Package, Tag, History, Camera, ChevronDown, Check, Wind, Scissors, Ruler } from "lucide-react";
import { StockData, StockItem, LogEntry, Needs, Job, saveNotes, itemHistory, logLine, trackingUrl, gbp, checkItems, setJobDone, updateItem, landedCosts, sendInvoice } from "@/lib/stock";
import { StatusChip, BatchPill, FloorIcon, ModalHead, Confirmation, cx, dateLabel } from "./ui";
import { NeedTicks } from "./batches";
import s from "./stock.module.css";

type Tab = "overview" | "photos" | "details";

export function ItemPanel({ item, data, onClose, onChanged }: {
  item: StockItem;
  data: StockData;
  onClose: () => void;
  /** Something was saved: refresh, and show the message if there is one. */
  onChanged: (msg?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<LogEntry[] | null>(null);
  const batch = item.batch_id ? data.batches.find((b) => b.id === item.batch_id) : undefined;
  const category = data.categories.find((c) => c.id === item.category_id)?.name;
  const isOrder = ["paid", "in_transit", "to_check"].includes(item.status);
  const [pop, setPop] = useState<null | "ready" | "kept">(null);
  const [sent, setSent] = useState<{ cost: number; to: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // To check, one item at a time (mockup ic-dam / ic-kept / ic-ready)
  const check = async (o: Parameters<typeof checkItems>[2] extends Map<string, infer O> ? O : never, msg: string) => {
    if (!batch || busy) return;
    setBusy(true);
    try { await checkItems(batch, data, new Map([[item.id, o]])); setPop(null); onChanged(msg); }
    catch (e: any) { onChanged(e?.message || "Couldn't save it."); }
    finally { setBusy(false); }
  };

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

  // The headline: an order shows its rough price so far (paid + its two bank fees), marked "~".
  const rough = (item.paid ?? 0) + (item.non_gbp_fee ?? 0) + (item.purchase_fee ?? 0);
  const headline = isOrder && (item.paid != null || item.non_gbp_fee != null || item.purchase_fee != null)
    ? <span className={s.hl}><b className={s.muted}>{item.item_cost != null ? gbp(item.item_cost) : "~" + gbp(rough)}</b></span>
    : null;

  const row = (k: string, v: string | null | undefined) => (v === null || v === undefined || v === "") ? null : <div className={s.kvr}><span>{k}</span><span>{v}</span></div>;
  const group = (title: string, rows: (React.ReactNode | null)[]) => rows.some(Boolean) ? <div className={s.kvg}><span className={s.lbl}>{title}</span>{rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)}</div> : null;

  const cells: [React.ReactNode, string, string][] = [
    [<Package key="i" className="w-4 h-4" />, "Final landing cost", item.item_cost != null && !isOrder ? gbp(item.item_cost) : "—"],
    [<Tag key="i" className="w-4 h-4" />, "Item's price", item.source === "imported" ? (item.paid != null ? gbp(item.paid) : "—") : (item.item_cost != null ? gbp(item.item_cost) : "—")],
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
              {item.status === "prep" ? (
                <PrepForm item={item} data={data} notes={notes} setNotes={setNotes} saveNotes={saveNotesIfChanged} onChanged={onChanged} />
              ) : (
                <label className={s.notes}>
                  <span className={s.lbl}>Notes</span>
                  <textarea className={s.inp} rows={3} aria-label="Notes" value={notes}
                    onChange={(e) => setNotes(e.target.value)} onBlur={saveNotesIfChanged} />
                </label>
              )}
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
                row("Paid", item.paid != null ? gbp(item.paid) : null),
                row("Non-GBP fee", item.non_gbp_fee != null ? gbp(item.non_gbp_fee) : null), row("Purchase fee", item.purchase_fee != null ? gbp(item.purchase_fee) : null),
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
        {item.status === "to_check" && (
          <div className={s.foot}>
            <button className={s.btn} disabled={busy} onClick={() => check({ out: "damaged", refund: null }, "Marked damaged")}>Damaged</button>
            <button className={s.btn} disabled={busy} onClick={() => setPop("kept")}>Kept</button>
            <button className={s.btnw} disabled={busy} onClick={() => setPop("ready")}>Ready</button>
          </div>
        )}
      </aside>
      {pop === "ready" && <ReadyDialog item={item} busy={busy} onClose={() => setPop(null)}
        onSave={(n) => check({ out: "ready", needs: n }, n.steam || n.repair || n.measure ? "Ready. Moved to Prep" : "Ready. Moved to Photos")} />}
      {pop === "kept" && <KeptDialog item={item} busy={busy} onClose={() => setPop(null)}
        onPick={async (by) => {
          // Kept: save it, then email the invoice (a PDF) to whoever kept it.
          if (!batch || busy) return;
          setBusy(true);
          try {
            const cost = landedCosts(batch, data.items, data.settings.floorMarkup).get(item.id)?.item_cost ?? 0;
            await checkItems(batch, data, new Map([[item.id, { out: "kept", by }]]));
            setPop(null);
            try { await sendInvoice(item.id); setSent({ cost, to: by }); onChanged(); }
            catch (e: any) { onChanged(`Kept by ${by}. Invoice not sent: ${e?.message}`); }
          } catch (e: any) { onChanged(e?.message || "Couldn't save it."); }
          finally { setBusy(false); }
        }} />}
      {sent && <Confirmation label="Invoice sent" value={gbp(sent.cost)} line={`Emailed to ${sent.to}`} onClose={() => setSent(null)} />}
    </div>,
    document.body,
  );
}

/** The item at the top of a small pop-up (mockup itemHead). */
function ItemHead({ item }: { item: StockItem }) {
  return <div className={s.mitem}><span className={s.mono}>{item.code}{item.sku ? ` · ${item.sku}` : ""}</span><span className={s.mname}>{item.name}</span></div>;
}

/** Ready (mockup 'ready'): what it needs, then Save. */
function ReadyDialog({ item, busy, onClose, onSave }: { item: StockItem; busy: boolean; onClose: () => void; onSave: (n: Needs) => void }) {
  const [n, setN] = useState<Needs>({ steam: item.needs_steam, repair: item.needs_repair, measure: item.needs_measure });
  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm)} role="dialog" aria-modal="true" aria-label="Ready">
        <ModalHead title="Ready" onClose={onClose} />
        <ItemHead item={item} />
        <NeedTicks value={n} onChange={setN} />
        <button className={s.btnw} disabled={busy} onClick={() => onSave(n)}>Save</button>
      </div>
    </div>,
    document.body,
  );
}

/** Kept (mockup 'kept'): who kept it. */
function KeptDialog({ item, busy, onClose, onPick }: { item: StockItem; busy: boolean; onClose: () => void; onPick: (by: "Eryk" | "Alex") => void }) {
  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm)} role="dialog" aria-modal="true" aria-label="Kept by">
        <ModalHead title="Kept by" onClose={onClose} />
        <ItemHead item={item} />
        <div className={s.mf}>
          {(["Eryk", "Alex"] as const).map((w) => <button key={w} className={s.btn} disabled={busy} onClick={() => onPick(w)}>{w}</button>)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A dropdown in the app's style (mockup dd): the list floats above everything, under its button. */
function Dropdown({ label, value, options, onPick }: { label: string; value: string | null; options: { v: string; t: string }[]; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target as Element).closest?.("[data-ddm]") && !btn.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  const toggle = () => {
    if (open) return setOpen(false);
    const r = btn.current!.getBoundingClientRect();
    const h = Math.min(260, options.length * 38 + 8);
    const up = r.bottom + 6 + h > window.innerHeight - 8;
    setPos({ top: up ? r.top - 6 - h : r.bottom + 6, left: r.left, width: r.width });
    setOpen(true);
  };
  const shown = options.find((o) => o.v === value)?.t;
  return (
    <div className={s.dd}>
      <button type="button" ref={btn} className={cx(s.inp, s.ddb)} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={toggle}>
        <span className={shown ? "" : s.ddph}>{shown ?? label}</span><ChevronDown className="w-[14px] h-[14px]" />
      </button>
      {open && pos && createPortal(
        <div className={s.root} style={{ display: "contents" }}>
          <div className={s.ddm} data-ddm role="listbox" aria-label={label} style={pos}>
            {options.map((o) => (
              <button key={o.v} type="button" role="option" aria-selected={o.v === value} onClick={() => { onPick(o.v); setOpen(false); }}>
                <span>{o.t}</span>{o.v === value && <Check className="w-[14px] h-[14px]" />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const JOBS: { key: Job; label: string; Icon: typeof Wind }[] = [
  { key: "steam", label: "Steam", Icon: Wind },
  { key: "repair", label: "Repair", Icon: Scissors },
  { key: "measure", label: "Measure", Icon: Ruler },
];

/** Prep (mockup actionFor 'Prep'): tick each job when it's done, and the measuring form under them. */
function PrepForm({ item, data, notes, setNotes, saveNotes, onChanged }: {
  item: StockItem; data: StockData; notes: string; setNotes: (v: string) => void; saveNotes: () => void; onChanged: (msg?: string) => void;
}) {
  const [size, setSize] = useState(item.size ?? "");
  const [meas, setMeas] = useState<Record<string, string>>(item.measurements ?? {});
  useEffect(() => { setSize(item.size ?? ""); setMeas(item.measurements ?? {}); }, [item.id, item.size, item.measurements]);
  const cat = data.categories.find((c) => c.id === item.category_id);
  const fits = cat?.measurements ?? [];
  const done: Record<Job, boolean> = { steam: item.steam_done, repair: item.repair_done, measure: item.measure_done };
  const need: Record<Job, boolean> = { steam: item.needs_steam, repair: item.needs_repair, measure: item.needs_measure };
  const save = (patch: Parameters<typeof updateItem>[1]) => updateItem(item.id, patch).then(() => onChanged()).catch((e) => onChanged(e?.message || "Couldn't save it."));

  return (
    <div className={s.ov} style={{ gap: 14 }}>
      <span className={s.lbl}>Stage</span>
      <div className={s.jobs}>
        {/* Only the jobs ticked at the check are shown (Eryk, 25 Nov). */}
        {JOBS.filter(({ key }) => need[key]).map(({ key, label, Icon }) => (
          <button key={key} type="button" className={s.tick} aria-pressed={done[key]} aria-label={`${label}${done[key] ? " done" : ""}`} title={label}
            onClick={async () => {
              try { const moved = await setJobDone(item, key, !done[key]); onChanged(moved ? "Prep done. Moved to Photos" : undefined); }
              catch (e: any) { onChanged(e?.message || "Couldn't save it."); }
            }}>
            <Icon className="w-[18px] h-[18px]" strokeWidth={2} /><span className={s.box} />
          </button>
        ))}
      </div>
      <div className={s.mform}>
        <div className={s.g2}>
          <Dropdown label="Category" value={item.category_id} options={data.categories.filter((c) => c.active || c.id === item.category_id).map((c) => ({ v: c.id, t: c.name }))}
            onPick={(v) => save({ category_id: v })} />
          <label className={s.fi}><span>Size</span><input className={s.inp} aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)}
            onBlur={() => { if (size !== (item.size ?? "")) save({ size: size.trim() || null }); }} /></label>
        </div>
        <Dropdown label="Condition" value={item.condition} options={data.settings.conditions.map((c) => ({ v: c, t: c }))} onPick={(v) => save({ condition: v })} />
        {fits.length > 0 && (
          <div className={s.g2}>
            {fits.map((m) => (
              <label key={m} className={s.fi}><span>{m} (in)</span>
                <input className={s.inp} inputMode="decimal" aria-label={`${m} in inches`} value={meas[m] ?? ""}
                  onChange={(e) => setMeas((p) => ({ ...p, [m]: e.target.value }))}
                  onBlur={() => {
                    const next = Object.fromEntries(Object.entries(meas).filter(([, v]) => v.trim() !== ""));
                    if (JSON.stringify(next) !== JSON.stringify(item.measurements ?? {})) save({ measurements: next });
                  }} />
              </label>
            ))}
          </div>
        )}
        <textarea className={s.inp} rows={2} placeholder="Notes" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} />
      </div>
    </div>
  );
}
