"use client";

import React, { useEffect, useRef, useState } from "react";
import { Event } from "@/lib/types";
import { PromptDialog } from "./study-clock-dialogs";

const LEAD_MINUTES = 10;

const eventStart = (e: Event) => {
  if (!e.event_time) return null;
  const [h, m] = e.event_time.split(":").map(Number);
  const d = new Date(`${e.event_date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};
const seenKey = (e: Event) => `lecture-reminded-${e.id}-${e.event_date}-${e.event_time}`;
const wasReminded = (e: Event) => { try { return localStorage.getItem(seenKey(e)) === "1"; } catch { return false; } };
const markReminded = (e: Event) => { try { localStorage.setItem(seenKey(e), "1"); } catch { /* optional */ } };

/** A "ding-dong" that repeats every 3 seconds until stopped. Different from the study timer's ring. */
function startDingDong(): () => void {
  const play = () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ([[0, 659], [0.45, 523]] as const).forEach(([t, f]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.9);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.95);
      });
      setTimeout(() => ctx.close(), 2000);
    } catch { /* sound is optional */ }
  };
  play();
  const loop = setInterval(play, 3000);
  return () => clearInterval(loop);
}

/**
 * 10 minutes before a timed Study event (a lecture), shows a pop-up and a Mac
 * notification and plays a ding-dong until you press OK. Works while the app
 * is open in Arc, on any page.
 */
export function LectureReminder({ events }: { events: Event[] }) {
  const [due, setDue] = useState<Event | null>(null);
  const stopSound = useRef<() => void>(() => {});
  const latest = useRef(events);
  latest.current = events;

  useEffect(() => {
    const check = () => {
      if (due) return;
      const now = Date.now();
      const next = latest.current
        .filter(e => (e.domain ?? "WORK") === "STUDY" && e.event_time)
        .find(e => {
          const start = eventStart(e)?.getTime();
          return start !== undefined && now >= start - LEAD_MINUTES * 60_000 && now < start && !wasReminded(e);
        });
      if (!next) return;
      markReminded(next);
      stopSound.current = startDingDong();
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification(`${next.title} at ${next.event_time!.slice(0, 5)}`, {
            body: "Starts in 10 minutes.",
            tag: seenKey(next),
            requireInteraction: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
        }
      } catch { /* notifications are optional */ }
      setDue(next);
    };
    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, [due]);

  // While it's showing, the tab title flashes too.
  useEffect(() => {
    if (!due) return;
    const original = document.title;
    let flip = false;
    const t = setInterval(() => { flip = !flip; document.title = flip ? `${due.title} soon` : original; }, 1000);
    return () => { clearInterval(t); document.title = original; };
  }, [due]);

  useEffect(() => () => stopSound.current(), []);

  if (!due) return null;
  const start = eventStart(due)!;
  const mins = Math.max(0, Math.ceil((start.getTime() - Date.now()) / 60_000));
  const confirm = () => { stopSound.current(); setDue(null); };

  return (
    <PromptDialog
      icon="bell"
      mustChoose
      stacked
      title={`${due.title} at ${due.event_time!.slice(0, 5)}`}
      detail={mins > 0 ? `Starts in ${mins} minute${mins === 1 ? "" : "s"}.` : "Starting now."}
      confirmLabel="OK"
      cancelLabel=""
      onConfirm={confirm}
      onCancel={confirm}
    />
  );
}
