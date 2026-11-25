"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Check } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  loadStock, StockData, StockItem, StockBatch, GROUPS, GroupKey, STATUS_LABEL, inStock, gbp,
} from "@/lib/stock";
import { AddStockDialog } from "./add-stock-dialog";
import { BatchList, BatchPanel, ShipDialog } from "./batches";
import { ItemPanel } from "./item-panel";
import { StatusChip, BatchPill, cx } from "./ui";
import s from "./stock.module.css";


/** The price shown in the list: an order's rough price (paid + its two bank fees), or what it cost. */
function priceOf(it: StockItem): string | null {
  if (["paid", "in_transit", "to_check"].includes(it.status)) {
    if (it.item_cost != null) return gbp(it.item_cost);
    if (it.paid == null && it.non_gbp_fee == null && it.purchase_fee == null) return null;
    return "~" + gbp((it.paid ?? 0) + (it.non_gbp_fee ?? 0) + (it.purchase_fee ?? 0));
  }
  if (["live", "taken_down"].includes(it.status) && it.current_price != null) return gbp(it.current_price);
  return null;
}

export function StockView() {
  const [data, setData] = useState<StockData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GroupKey>("Live");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Open panels / pop-ups, by id so they always show the latest data.
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [shipping, setShipping] = useState<string | null>(null);
  const findRef = useRef<HTMLInputElement>(null);

  // ⌘K jumps to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); findRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = useCallback(async () => {
    try { setData(await loadStock()); setLoadError(null); }
    catch (e: any) { setLoadError(e?.message || "Couldn't load stock."); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Alex and Eryk see each other's changes straight away.
  useEffect(() => {
    const ch = supabase.channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_batches" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const items = data?.items ?? [];
  const batchById = useMemo(() => new Map((data?.batches ?? []).map((b) => [b.id, b])), [data]);
  const group = GROUPS.find((g) => g.key === filter)!;
  const inGroup = (it: StockItem, g: (typeof GROUPS)[number]) => (g.statuses as readonly string[]).includes(it.status);

  const list = q.trim()
    ? items.filter((it) => `${it.name} ${it.code} ${it.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    : items.filter((it) => inGroup(it, group));
  const today = new Date();

  return (
    <div className={s.root}>
      <div className={s.bar}><h2 className={s.h2}>Stock</h2></div>

      <div className={s.filterrow}>
        <div className={s.filters}>
          {GROUPS.map((g) => (
            <button key={g.key} className={cx(s.f, filter === g.key && !q && s.on)} style={{ "--c": g.colour } as React.CSSProperties} onClick={() => { setFilter(g.key); setQ(""); }}>
              <span className={s.dot} />{g.key}<span className={s.n}>{items.filter((it) => inGroup(it, g)).length}</span>
            </button>
          ))}
        </div>
        <div className={s.rside}>
          <span className={s.tot} title="Items in stock: from arrival until they exit">{items.filter(inStock).length} in stock</span>
        </div>
      </div>

      {filter === "Orders" && !q && data && data.batches.length > 0 && (
        <BatchList data={data} onOpen={(b) => setOpenBatch(b.id)} onShip={(b) => setShipping(b.id)} />
      )}

      <div className={s.list}>
        <div className={s.rowh}>
          <span /><span className={s.lbl}>ID / SKU</span><span className={s.lbl}>Item</span><span className={s.lbl}>Status</span>
          <span className={s.lbl}>{filter === "Orders" && !q ? "Batch" : "Stage"}</span>
          <span className={cx(s.lbl, s.c)}>Since</span><span className={cx(s.lbl, s.c)}>{filter === "Sold" && !q ? "Sold" : "Price"}</span>
          <span className={s.lbl} style={{ textAlign: "right" }}>Platforms</span>
        </div>
        {loadError ? (
          <div className={s.empty}>{loadError}</div>
        ) : !data ? (
          <div className={s.empty}>Loading…</div>
        ) : list.length === 0 ? (
          <div className={s.empty}>Nothing here.</div>
        ) : list.map((it) => {
          const batch = it.batch_id ? batchById.get(it.batch_id) : undefined;
          const since = differenceInCalendarDays(today, parseISO(it.status_since));
          const price = priceOf(it);
          return (
            <div key={it.id} className={cx(s.r, s.click)} role="button" tabIndex={0} onClick={() => setOpenItem(it.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpenItem(it.id); }}>
              <span />
              <span className={cx(s.mono, s.id)}>{it.sku || it.code}</span>
              <span className={s.nm}>{it.name}</span>
              <span className={s.st}><StatusChip status={it.status} /></span>
              <span className={s.info}>{batch ? <BatchPill n={batch.number} /> : null}</span>
              <span className={s.since} title={`${since} days in ${STATUS_LABEL[it.status]}`}>{since}d</span>
              <span className={s.pr}>{price ?? <span className={s.dash}>—</span>}</span>
              <span className={s.plat}><span className={s.dash}>—</span></span>
            </div>
          );
        })}
      </div>

      <div className={s.dock}>
        <div className={s.findbar}>
          <Search className="w-[15px] h-[15px] text-[#8a8a8a]" strokeWidth={2} />
          <input ref={findRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find an item by name, ID or SKU" autoComplete="off" />
          <span className={s.k}>{q.trim() ? `${list.length} found` : "⌘K"}</span>
        </div>
        <button className={s.addbtn} onClick={() => setAdding(true)} aria-label="Add stock" title="Add stock">
          <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
      </div>

      {data && openBatch && (() => {
        const b = data.batches.find((x) => x.id === openBatch);
        return b ? <BatchPanel batch={b} data={data} onClose={() => setOpenBatch(null)}
          onOpenItem={(id) => { setOpenBatch(null); setOpenItem(id); }} onShip={(x: StockBatch) => setShipping(x.id)} /> : null;
      })()}

      {data && openItem && (() => {
        const it = data.items.find((x) => x.id === openItem);
        return it ? <ItemPanel item={it} data={data} onClose={() => setOpenItem(null)} /> : null;
      })()}

      {data && shipping && (() => {
        const b = data.batches.find((x) => x.id === shipping);
        return b ? <ShipDialog batch={b} onClose={() => setShipping(null)}
          onShipped={(next) => { setShipping(null); setToast(`Batch ${b.number} shipped. Batch ${next} is collecting`); refresh(); }} /> : null;
      })()}

      {adding && data && (
        <AddStockDialog
          data={data}
          onClose={() => setAdding(false)}
          onAdded={(code, another) => { refresh(); if (another) setToast(`Added · ${code}`); }}
        />
      )}

      {toast && typeof document !== "undefined" && createPortal(
        <div className={cx(s.root, s.toast)} role="status"><Check className="w-[14px] h-[14px]" strokeWidth={3} /><span>{toast}</span></div>,
        document.body,
      )}
    </div>
  );
}
