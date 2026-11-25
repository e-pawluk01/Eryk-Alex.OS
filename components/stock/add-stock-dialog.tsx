"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Check, Wind, Scissors, Ruler } from "lucide-react";
import { addItem, StockData, Source, STATUS_COLOUR } from "@/lib/stock";
import { BatchPill } from "./ui";
import s from "./stock.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
const SOURCES: { key: Source; label: string }[] = [
  { key: "imported", label: "Imported" },
  { key: "online", label: "Bought online" },
  { key: "donated", label: "Donated" },
];
const NEEDS = [
  { key: "steam", label: "Steam", Icon: Wind },
  { key: "repair", label: "Repair", Icon: Scissors },
  { key: "measure", label: "Measure", Icon: Ruler },
] as const;

type Form = {
  name: string; brand: string; category_id: string | null;
  bank_fee: string; bought_on: string; site_price: string; link: string; item_cost: string;
  needs: { steam: boolean; repair: boolean; measure: boolean };
};
const EMPTY: Form = {
  name: "", brand: "", category_id: null, bank_fee: "", bought_on: "", site_price: "", link: "", item_cost: "",
  needs: { steam: false, repair: false, measure: false },
};
/** "£6.58", "6.58" or "" → 6.58 / null */
const money = (v: string) => { const n = parseFloat(v.replace(/[£,\s]/g, "")); return Number.isFinite(n) ? n : null; };

export function AddStockDialog({ data, onClose, onAdded }: {
  data: StockData;
  onClose: () => void;
  onAdded: (code: string, another: boolean) => void;
}) {
  const [src, setSrc] = useState<Source>("imported");
  const [f, setF] = useState<Form>(EMPTY);
  const [catOpen, setCatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [more, setMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const catBtnRef = useRef<HTMLButtonElement>(null);
  const [catPos, setCatPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // The batch new imports go into: the collecting one, or the number it will get.
  const collecting = data.batches.find((b) => b.status === "collecting");
  const batchNo = collecting?.number ?? Math.max(0, ...data.batches.map((b) => b.number)) + 1;
  const categories = data.categories.filter((c) => c.active);
  const catName = categories.find((c) => c.id === f.category_id)?.name;

  // One size for every source: the Donated form's, measured on this screen.
  // Longer forms scroll between the fixed header and buttons.
  useLayoutEffect(() => {
    const measure = () => { if (measureRef.current) setHeight(measureRef.current.offsetHeight); };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Soft fade at the bottom while more fields are hidden below.
  const checkFade = () => {
    const el = scrollRef.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };
  useLayoutEffect(checkFade, [src, height, added]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (catOpen ? setCatOpen(false) : onClose()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [catOpen, onClose]);

  const openCat = () => {
    const r = catBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const listH = Math.min(260, categories.length * 38 + 8);
    const up = r.bottom + 6 + listH > window.innerHeight - 8;
    setCatPos({ top: up ? r.top - 6 - listH : r.bottom + 6, left: r.left, width: r.width });
    setCatOpen(true);
  };

  const save = async (another: boolean) => {
    if (!f.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const code = await addItem({
        source: src, name: f.name, brand: f.brand, category_id: f.category_id,
        bank_fee: money(f.bank_fee), site_price: money(f.site_price), bought_on: f.bought_on, link: f.link,
        item_cost: money(f.item_cost), needs: f.needs,
      });
      onAdded(code, another);
      if (another) { setF(EMPTY); scrollRef.current?.scrollTo({ top: 0 }); }
      else setAdded(code);
    } catch (e: any) {
      setError(e?.message || "Couldn't add it.");
    } finally {
      setSaving(false);
    }
  };

  const head = (t: string) => (
    <div className={s.mh}>
      <span className={s.lbl}>{t}</span>
      <button className={s.x} onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
    </div>
  );

  const field = (label: string, k: keyof Form, live: boolean, inputMode?: "decimal") => (
    <label className={s.fo}>
      <span>{label}</span>
      <input className={s.inp} aria-label={label.replace(" £", "")} inputMode={inputMode}
        value={live ? (f[k] as string) : ""} readOnly={!live} tabIndex={live ? undefined : -1}
        onChange={live ? (e) => set(k, e.target.value as never) : undefined} />
    </label>
  );

  const catSel = (live: boolean) => (
    <div className={s.fo}>
      <span>Category</span>
      <div className={s.dd}>
        <button type="button" ref={live ? catBtnRef : undefined} tabIndex={live ? undefined : -1}
          className={cx(s.inp, s.ddb)} aria-haspopup="listbox" aria-expanded={live && catOpen} aria-label="Category"
          onClick={live ? () => (catOpen ? setCatOpen(false) : openCat()) : undefined}>
          <span className={live && catName ? "" : s.ddph}>{(live && catName) || "Choose"}</span>
          <ChevronDown className="w-[14px] h-[14px]" />
        </button>
      </div>
    </div>
  );

  const needs = (live: boolean) => (
    <div className={s.fo}>
      <span>Needs</span>
      <div className={s.jobs}>
        {NEEDS.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={s.tick} tabIndex={live ? undefined : -1}
            aria-pressed={live && f.needs[key]} aria-label={label} title={label}
            onClick={live ? () => set("needs", { ...f.needs, [key]: !f.needs[key] }) : undefined}>
            <Icon className="w-[18px] h-[18px]" strokeWidth={2} /><span className={s.box} />
          </button>
        ))}
      </div>
    </div>
  );

  const fields = (which: Source, live: boolean) => which === "imported" ? (
    <>
      <div className={s.addto}>
        <span>Added to:</span><BatchPill n={batchNo} />
        <span className={cx(s.chip, s.solid)} style={{ "--c": STATUS_COLOUR.paid } as React.CSSProperties}>Collecting</span>
      </div>
      {field("Name", "name", live)}
      <div className={s.g2}>{catSel(live)}{field("Brand", "brand", live)}</div>
      {field("Bank fee £", "bank_fee", live, "decimal")}
      <div className={s.g2}>{field("Marketplace", "bought_on", live)}{field("Site price £", "site_price", live, "decimal")}</div>
      {field("Link", "link", live)}
    </>
  ) : which === "online" ? (
    <>
      {field("Name", "name", live)}
      <div className={s.g2}>{catSel(live)}{field("Brand", "brand", live)}</div>
      <div className={s.g2}>{field("Item cost £", "item_cost", live, "decimal")}{field("Bought from", "bought_on", live)}</div>
      {needs(live)}
    </>
  ) : (
    <>
      {field("Name", "name", live)}
      <div className={s.g2}>{catSel(live)}{field("Brand", "brand", live)}</div>
      {needs(live)}
    </>
  );

  const seg = (live: boolean) => (
    <div className={s.seg} role="radiogroup" aria-label="Source">
      {SOURCES.map((o) => (
        <button key={o.key} role="radio" aria-checked={src === o.key} tabIndex={live ? undefined : -1}
          className={src === o.key ? s.on : undefined}
          onClick={live ? () => { setSrc(o.key); setError(null); setCatOpen(false); } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const buttons = (live: boolean) => (
    <div className={s.mf}>
      <button className={s.btn} disabled={live && (!f.name.trim() || saving)} tabIndex={live ? undefined : -1} onClick={live ? () => save(true) : undefined}>Add another</button>
      <button className={s.btnw} disabled={live && (!f.name.trim() || saving)} tabIndex={live ? undefined : -1} onClick={live ? () => save(false) : undefined}>Add</button>
    </div>
  );

  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      {added ? (
        <div className={s.modal} role="dialog" aria-modal="true" aria-label="Added">
          {head("Added")}
          <div className={s.bigid}><span className={s.mono}>{added}</span></div>
        </div>
      ) : (
        <div className={s.modal} role="dialog" aria-modal="true" aria-label="Add stock" style={height ? { height: `min(${height}px, calc(100dvh - 48px))` } : undefined}
          onPointerDown={(e) => { if (catOpen && !catBtnRef.current?.contains(e.target as Node)) setCatOpen(false); }}>
          {head("Add stock")}
          {seg(true)}
          <div ref={scrollRef} className={cx(s.addscroll, more && s.more)} onScroll={() => { checkFade(); setCatOpen(false); }}>{fields(src, true)}</div>
          {error && <div className={s.err}>{error}</div>}
          {buttons(true)}
        </div>
      )}

      {/* Invisible copy of the Donated form, only to measure the pop-up's height. */}
      <div ref={measureRef} className={s.modal} aria-hidden="true"
        style={{ visibility: "hidden", pointerEvents: "none", animation: "none", height: "fit-content", inset: "auto", top: 0, left: 0 }}>
        {head("Add stock")}
        {seg(false)}
        <div className={s.addscroll} style={{ flex: "none" }}>{fields("donated", false)}</div>
        {buttons(false)}
      </div>

      {catOpen && catPos && (
        <div className={s.ddm} role="listbox" aria-label="Category" style={catPos}>
          {categories.map((c) => (
            <button key={c.id} type="button" role="option" aria-selected={c.id === f.category_id}
              onClick={() => { set("category_id", c.id); setCatOpen(false); }}>
              <span>{c.name}</span>{c.id === f.category_id && <Check className="w-[14px] h-[14px]" />}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
