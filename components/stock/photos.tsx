"use client";

// The Photos stage pop-ups (mockup v129): the one-time "Photo folder" choice, and the photo inbox
// (groups by time taken, Split, pick the item per group, Sort into OS Photos/<code> as JPGs).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StockData, photosDone } from "@/lib/stock";
import { FolderState, InboxPhoto, chooseFolder, allowFolder, readInbox, groupByTime, sortGroups } from "@/lib/photos";
import { Select } from "@/components/ui/select";
import { ModalHead, cx } from "./ui";
import s from "./stock.module.css";

type Dir = FileSystemDirectoryHandle;

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** First time: choose the OS Photos folder. Later, if Arc forgets: one click to allow it again. */
export function PhotoFolderDialog({ folder, onClose, onReady }: {
  folder: FolderState; onClose: () => void; onReady: (dir: Dir) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const first = folder.state === "none";
  useEscape(onClose);
  const go = async () => {
    setError(null);
    try {
      if (folder.state === "ask") { if (await allowFolder(folder.dir)) onReady(folder.dir); else setError("Arc didn't allow it."); }
      else onReady(await chooseFolder());
    } catch (e: any) { if (e?.name !== "AbortError") setError(e?.message || "Couldn't open the folder."); }
  };
  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm)} role="dialog" aria-modal="true" aria-label="Photo folder">
        <ModalHead title="Photo folder" onClose={onClose} />
        <span className={s.sub}>{first ? "Choose the OS Photos folder. The app remembers it." : "Arc needs your OK to open OS Photos again."}</span>
        {error && <div className={s.err}>{error}</div>}
        <button className={s.btnw} onClick={go}>{first ? "Choose folder" : "Allow access"}</button>
      </div>
    </div>,
    document.body,
  );
}

/** The photo inbox: OS Photos/Inbox, grouped by when the photos were taken. One fixed size; groups scroll inside. */
export function PhotoInbox({ dir, data, onClose, onSorted }: {
  dir: Dir; data: StockData; onClose: () => void; onSorted: (msg: string) => void;
}) {
  const [photos, setPhotos] = useState<InboxPhoto[] | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [groups, setGroups] = useState<InboxPhoto[][]>([]);
  const [pickFor, setPickFor] = useState<Record<number, string>>({});
  const [splitting, setSplitting] = useState<number | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  const waiting = data.items.filter((i) => i.status === "photos").sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  useEffect(() => {
    let alive = true;
    readInbox(dir, (d, t) => alive && setProgress([d, t]))
      .then((p) => {
        if (!alive) return;
        setPhotos(p);
        const g = groupByTime(p);
        setGroups(g);
        // Start each group on the next item waiting for photos, in code order.
        setPickFor(Object.fromEntries(g.map((_, i) => [i, waiting[i]?.id ?? ""])));
      })
      .catch((e) => alive && setError(e?.message || "Couldn't read the Inbox."));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);
  useEffect(() => () => photos?.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  // Split: the ticked photos become a new group right after this one.
  const splitGo = (gi: number) => {
    const g = groups[gi];
    const stay = g.filter((p) => !ticked.has(p.name)), move = g.filter((p) => ticked.has(p.name));
    if (!stay.length || !move.length) return;
    const next = [...groups.slice(0, gi), stay, move, ...groups.slice(gi + 1)];
    const picks: Record<number, string> = {};
    next.forEach((_, i) => { picks[i] = i <= gi ? pickFor[i] ?? "" : i === gi + 1 ? "" : pickFor[i - 1] ?? ""; });
    setGroups(next); setPickFor(picks); setSplitting(null); setTicked(new Set());
  };

  const ready = groups.length > 0 && groups.every((_, i) => pickFor[i]);
  const sort = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const byId = new Map(data.items.map((i) => [i.id, i]));
      await sortGroups(dir, groups.map((g, i) => ({ folder: byId.get(pickFor[i])!.code, photos: g })));
      await photosDone([...new Set(Object.values(pickFor))]);
      onSorted(`Sorted ${groups.length} group${groups.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      setError(e?.message || "Couldn't sort them.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} />
      <div className={cx(s.modal, s.gapsm, s.wide, s.chkm)} role="dialog" aria-modal="true" aria-label="Photo inbox">
        <ModalHead title={`Photo inbox · OS Photos / Inbox${photos ? ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}`} onClose={onClose} />
        <div className={cx(s.inbox, s.fill)}>
          {!photos ? (
            <div className={s.center}><span className={s.sub}>{progress[1] ? `Reading photos · ${progress[0]} of ${progress[1]}` : "Reading photos"}</span></div>
          ) : !photos.length ? (
            <div className={s.center}><span className={s.sub}>Inbox is empty</span></div>
          ) : groups.map((g, gi) => {
            const sp = splitting === gi, n = ticked.size, ok = n > 0 && n < g.length;
            return (
              <div key={gi} className={s.igroup}>
                <div className={s.lrow}>
                  <span className={s.lbl}>{sp ? `Tick the other item’s photos · ${n} ticked` : `Group ${gi + 1} · ${g.length} photo${g.length === 1 ? "" : "s"}`}</span>
                  {sp ? (
                    <span style={{ display: "flex", gap: 8 }}>
                      <button className={cx(s.btn, s.sm)} onClick={() => { setSplitting(null); setTicked(new Set()); }}>Cancel</button>
                      <button className={cx(s.btn, s.sm)} disabled={!ok} onClick={() => splitGo(gi)}>New group</button>
                    </span>
                  ) : g.length > 1 ? <button className={cx(s.btn, s.sm)} onClick={() => { setSplitting(gi); setTicked(new Set()); }}>Split</button> : null}
                </div>
                <div className={cx(s.pgrid, s.five)}>
                  {g.map((p) => sp ? (
                    <button key={p.name} className={cx(s.pimg, s.pick, ticked.has(p.name) && s.pk)} aria-pressed={ticked.has(p.name)} aria-label={p.name}
                      onClick={() => setTicked((t) => { const x = new Set(t); x.has(p.name) ? x.delete(p.name) : x.add(p.name); return x; })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" /><span className={s.box} />
                    </button>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <span key={p.name} className={s.pimg} title={p.name}><img src={p.url} alt="" /></span>
                  ))}
                </div>
                <Select value={pickFor[gi] ?? ""} onChange={(v) => setPickFor((x) => ({ ...x, [gi]: v }))} placeholder="Which item?"
                  aria-label={`Item for group ${gi + 1}`} className={s.inp}
                  options={waiting.map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} />
              </div>
            );
          })}
        </div>
        {error && <div className={s.err}>{error}</div>}
        <button className={s.btnw} disabled={!ready || busy} onClick={sort}>{busy ? "Sorting" : groups.length ? `Sort ${groups.length} group${groups.length === 1 ? "" : "s"}` : "Sort"}</button>
      </div>
    </div>,
    document.body,
  );
}
