"use client";

// The app's dropdown (Eryk, 26 Nov: the native system menus should look like the stock mockup's dropdown).
// A box that opens a dark floating list just under it (above it if there's no room): compact rows,
// a tick on the chosen one, optional group headings. The list floats over everything, so the pop-up
// it sits in never changes size. Keyboard: Enter / Space / ↓ open it, ↑ ↓ move, Enter picks, Esc closes.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { group: string; options: SelectOption[] };

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | SelectGroup)[];
  /** Classes for the closed box (each dialog keeps its own box look). */
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
}

const flat = (opts: SelectProps["options"]) => opts.flatMap((o) => ("group" in o ? o.options : [o]));

export function Select({ value, onChange, options, className, disabled, placeholder, id, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [active, setActive] = useState(-1);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const all = flat(options);
  const current = all.find((o) => o.value === value);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const want = Math.min(280, all.length * 34 + options.filter((o) => "group" in o).length * 26 + 8);
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < want && above > below;
    const maxHeight = Math.min(want, up ? above : below);
    setPos({ top: up ? r.top - 6 - maxHeight : r.bottom + 6, left: r.left, width: r.width, maxHeight });
  };
  const openList = () => { if (disabled) return; place(); setActive(Math.max(0, all.findIndex((o) => o.value === value))); setOpen(true); };
  const pick = (v: string) => { onChange(v); setOpen(false); btn.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { const t = e.target as Node; if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false); };
    const scrolled = (e: Event) => { if (!list.current?.contains(e.target as Node)) setOpen(false); };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); setOpen(false); btn.current?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(all.length - 1, a + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); if (all[active]) pick(all[active].value); }
    };
    const resized = () => setOpen(false);
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", resized);
    window.addEventListener("keydown", keys, true);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", resized);
      window.removeEventListener("keydown", keys, true);
    };
  });
  useEffect(() => { if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);

  let i = -1;
  const row = (o: SelectOption) => {
    const n = ++i;
    return (
      <button key={o.value} type="button" role="option" aria-selected={o.value === value} data-i={n}
        onMouseEnter={() => setActive(n)} onClick={() => pick(o.value)}
        className={cn("flex w-full items-center justify-between gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] text-[#e5e5e5]", n === active && "bg-white/[0.08]")}>
        <span className="truncate">{o.label}</span>
        {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-white" />}
      </button>
    );
  };

  return (
    <>
      <button ref={btn} type="button" id={id} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={rest["aria-label"]}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); openList(); } }}
        className={cn(className, "flex items-center justify-between gap-2.5 text-left disabled:opacity-50")}>
        <span className={cn("truncate", !current && "text-white/40")}>{current?.label ?? placeholder ?? "Choose"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-white/50 transition-transform", open && "rotate-180")} />
      </button>
      {open && pos && createPortal(
        <div ref={list} role="listbox" aria-label={rest["aria-label"]}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="z-[400] flex flex-col overflow-y-auto rounded-[10px] border border-white/[0.12] bg-[#0f0f10] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-top-1 duration-200">
          {options.map((o) => "group" in o ? (
            o.options.length ? (
              <div key={o.group} className="flex flex-col">
                <span className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b8b8b]">{o.group}</span>
                {o.options.map(row)}
              </div>
            ) : null
          ) : row(o))}
        </div>,
        document.body,
      )}
    </>
  );
}
