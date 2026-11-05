"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Pencil, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLength, parseVideoId, shortTitle } from "@/lib/music";
import { MusicData, YTPlayer } from "./use-music";

type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Loads YouTube's player script once.
function loadYouTubeApi(): Promise<YTNamespace> {
  return new Promise(resolve => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT!); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

/**
 * The music panel, opened from the music button. It's one player that never
 * reloads, so music keeps going across pages; when the panel is closed it is
 * moved off screen rather than removed (Eryk chose to hide it fully).
 */
export function MusicPlayer({ music }: { music: MusicData }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(music);
  latest.current = music;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Build the player once, inside a node React doesn't manage.
  useEffect(() => {
    if (!mounted || !hostRef.current) return;
    const node = document.createElement("div");
    hostRef.current.appendChild(node);
    let cancelled = false;
    loadYouTubeApi().then(YT => {
      if (cancelled) return;
      new YT.Player(node, {
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        // YouTube refuses to play unless it knows which site it's embedded in.
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            latest.current.playerRef.current = e.target;
            const cur = latest.current.current;
            if (cur && latest.current.playing) e.target.loadVideoById(cur.video_id);
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            const m = latest.current;
            if (e.data === 1) {
              m.setPlaying(true);
              if (m.current && !m.current.seconds) {
                const d = Math.round(e.target.getDuration());
                if (d > 0) m.saveLength(m.current.id, d);
              }
            } else if (e.data === 2) m.setPlaying(false);
            else if (e.data === 0) m.next();
          },
        },
      });
    });
    return () => { cancelled = true; };
  }, [mounted]);

  if (!mounted) return null;
  const panel = music.open;

  // Closed panel: the player moves off screen (still running, so music keeps
  // playing) and the music button carries the controls.
  return createPortal(
    <div
      className={cn(
        "fixed z-[55] bg-zinc-950/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 flex flex-col w-80 p-4 gap-3",
        // Never taller than the window, so the playlist scrolls instead of running off screen.
        panel ? "right-6 bottom-24 max-w-[calc(100vw-3rem)] max-h-[calc(100dvh-7.5rem)]" : "-left-[10000px] top-0 pointer-events-none"
      )}
      aria-hidden={!panel}
    >
      <div key="head" className="shrink-0 flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Music</span>
        <button onClick={() => music.setOpen(false)} className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10" aria-label="Close music">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div key="video" className={cn("shrink-0 relative aspect-video rounded-lg overflow-hidden bg-black border border-border", !music.current && "hidden")}>
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
      </div>

      {panel && <Playlist key="list" music={music} />}
    </div>,
    document.body
  );
}

function Playlist({ music }: { music: MusicData }) {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  // Once you type a name yourself, the YouTube title no longer overwrites it.
  const nameTyped = useRef(false);
  const [found, setFound] = useState<{ videoId: string; full: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The track just added: scrolled into view and briefly highlighted.
  const [added, setAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const lookupFor = useRef<string | null>(null);

  const videoId = parseVideoId(link);

  useEffect(() => {
    if (!added) return;
    listRef.current?.querySelector(`[data-track="${added}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setAdded(null), 2500);
    return () => clearTimeout(t);
  }, [added]);

  async function fetchTitle(id: string) {
    try {
      const res = await fetch(`/api/youtube-title?id=${id}`);
      if (res.ok) return String((await res.json()).title ?? "");
    } catch { /* name it yourself */ }
    return "";
  }

  // Paste a link and the name fills in from YouTube straight away.
  const changeLink = async (value: string) => {
    setLink(value);
    setError(null);
    const id = parseVideoId(value);
    if (!id) { lookupFor.current = null; nameTyped.current = false; setName(""); setLookingUp(false); return; }
    if (id === lookupFor.current) return;
    lookupFor.current = id;
    setFound(null);
    setLookingUp(true);
    const full = await fetchTitle(id);
    if (lookupFor.current !== id) return; // the link changed meanwhile
    setLookingUp(false);
    setFound({ videoId: id, full });
    if (!nameTyped.current) setName(full ? shortTitle(full) : "");
    if (!full) nameRef.current?.focus();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!videoId) { setError("That doesn't look like a YouTube video link."); return; }
    if (music.tracks.some(t => t.video_id === videoId)) { setError("That track is already in your playlist."); return; }
    setBusy(true);
    setError(null);
    let title = name.trim();
    if (!title) {
      const full = found?.videoId === videoId ? found.full : await fetchTitle(videoId);
      title = full ? shortTitle(full) : "";
    }
    if (!title) {
      setBusy(false);
      setError("YouTube didn't give a title. Type a name for it.");
      nameRef.current?.focus();
      return;
    }
    try {
      const track = await music.addTrack(videoId, title);
      setLink(""); setName(""); setFound(null);
      nameTyped.current = false;
      lookupFor.current = null;
      setAdded(track.id);
    } catch (err) {
      console.error("Failed to add track:", err);
      setError("Couldn't save that track.");
    }
    setBusy(false);
  };

  const finishRename = () => {
    if (!editing) return;
    const title = editing.title.trim();
    const track = music.tracks.find(t => t.id === editing.id);
    if (title && track && title !== track.title) music.renameTrack(editing.id, title);
    setEditing(null);
  };

  const input = "flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/25";

  return (
    <>
      <div
        ref={listRef}
        className="flex flex-col min-h-0 max-h-80 overflow-y-auto overscroll-contain -mr-2 pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
      >
        {music.tracks.map(t => {
          const on = music.current?.id === t.id;
          if (editing?.id === t.id) {
            return (
              <div key={t.id} data-track={t.id} className="shrink-0 flex items-center gap-2 px-2 py-1">
                <span className="w-3 shrink-0" />
                <input
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); finishRename(); }
                    if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
                  }}
                  onBlur={finishRename}
                  autoFocus
                  onFocus={e => e.target.select()}
                  aria-label="Track name"
                  className="flex-1 min-w-0 bg-black/40 border border-white/20 rounded-md px-2 py-1 text-[13px] text-white outline-none focus:border-white/40"
                />
              </div>
            );
          }
          return (
            <div
              key={t.id}
              data-track={t.id}
              onClick={() => (on ? music.toggle() : music.play(t.id))}
              className={cn(
                "group shrink-0 flex items-center justify-between gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors duration-700",
                on ? "bg-white/[0.07] text-white" : added === t.id ? "bg-emerald-400/15 text-white" : "hover:bg-white/[0.04] text-white/85"
              )}
            >
              <span className="flex items-center gap-2 text-[13px] min-w-0">
                {on ? (music.playing ? <Pause className="w-3 h-3 shrink-0 fill-current" /> : <Play className="w-3 h-3 shrink-0 fill-current" />) : <span className="w-3 shrink-0" />}
                <span className="truncate">{t.title}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-[11px] text-white/40 tabular-nums">{formatLength(t.seconds)}</span>
                <button
                  onClick={e => { e.stopPropagation(); setEditing({ id: t.id, title: t.title }); }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-white/30 hover:text-white p-0.5 transition-opacity"
                  aria-label="Rename track"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); music.deleteTrack(t.id); }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-white/30 hover:text-red-400 p-0.5 transition-opacity"
                  aria-label="Remove track"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          );
        })}
        {!music.tracks.length && <p className="text-xs text-white/30 italic px-2 py-2">No tracks yet. Paste a YouTube link below.</p>}
      </div>

      <form onSubmit={save} className="shrink-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={link}
            onChange={e => changeLink(e.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            className={input}
          />
          <button disabled={busy || !videoId} className="px-3 bg-white text-black rounded-lg text-[10px] uppercase tracking-widest font-bold disabled:opacity-50">
            {busy ? "…" : "Add"}
          </button>
        </div>
        {videoId && (
          <input
            ref={nameRef}
            value={name}
            onChange={e => { setName(e.target.value); nameTyped.current = true; setError(null); }}
            placeholder={lookingUp ? "Getting the title from YouTube…" : "Name this track"}
            aria-label="Track name"
            className={input}
          />
        )}
        {videoId && found?.videoId === videoId && found.full && (
          <span className="text-[11px] text-white/30 truncate px-1">YouTube: {found.full}</span>
        )}
      </form>
      {error && <p className="shrink-0 text-[11px] text-red-400/80 px-1">{error}</p>}
    </>
  );
}
