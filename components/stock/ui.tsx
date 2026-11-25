"use client";

// Small pieces the Stock tab's list, panels and pop-ups share (copied from the mockup).
import { X } from "lucide-react";
import { StockBatch, StockItem, STATUS_COLOUR, STATUS_LABEL, EXITS, batchColour } from "@/lib/stock";
import s from "./stock.module.css";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const cvar = (c: string) => ({ "--c": c }) as React.CSSProperties;

export function StatusChip({ status }: { status: StockItem["status"] }) {
  const solid = status === "paid";
  const hollow = EXITS.includes(status) && status !== "sold";
  return <span className={cx(s.chip, solid && s.solid, hollow && s.hollow)} style={cvar(STATUS_COLOUR[status])}>{STATUS_LABEL[status]}</span>;
}

export function BatchPill({ n, label }: { n: number; label?: string }) {
  return <span className={s.chip} style={cvar(batchColour(n))}>{label ?? n}</span>;
}

const BATCH_CHIP: Record<StockBatch["status"], { label: string; colour: string; cls?: string }> = {
  collecting: { label: "Collecting", colour: STATUS_COLOUR.paid, cls: s.solid },
  shipped: { label: "Shipped", colour: STATUS_COLOUR.in_transit },
  arrived: { label: "Arrived", colour: STATUS_COLOUR.to_check },
  checked: { label: "Checked", colour: "#6ee7b7" },
  lost: { label: "Lost", colour: "#fca5a5" },
};
export function BatchChip({ status }: { status: StockBatch["status"] }) {
  const c = BATCH_CHIP[status];
  return <span className={cx(s.chip, c.cls)} style={cvar(c.colour)}>{c.label}</span>;
}

/** The pop-up title row: small grey label and a close X. */
export function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={s.mh}>
      <span className={s.lbl}>{title}</span>
      <button className={s.x} onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
    </div>
  );
}

export const dateLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

/** Floor price icon (mockup, 24 Nov): a price tag with an arrow down onto a line. */
export function FloorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 2h6l6 6-6 6-6-6z" /><circle cx="5" cy="5" r="0.8" /><path d="M18 9v9" /><path d="m15.5 15.5 2.5 2.5 2.5-2.5" /><path d="M3 22h18" />
    </svg>
  );
}
