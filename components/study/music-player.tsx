"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, X } from "lucide-react";
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
export function MusicPlayer({ music, inStudy }: { music: MusicData; inStudy: boolean }) {
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

  // Leaving Study shrinks the panel to the small player.
  useEffect(() => { if (!inStudy) music.setOpen(false); }, [inStudy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const panel = music.open && inStudy;

  // Closed panel: the player moves off screen (still running, so music keeps
  // playing) and the music button carries the controls.
  return createPortal(
    <div
      className={cn(
        "fixed z-[55] bg-zinc-950/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 flex flex-col w-80 p-4 gap-3",
        panel ? "right-6 bottom-24 max-w-[calc(100vw-3rem)]" : "-left-[10000px] top-0 pointer-events-none"
      )}
      aria-hidden={!panel}
    >
      <div key="head" className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Study music</span>
        <button onClick={() => music.setOpen(false)} className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10" aria-label="Close music">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div key="video" className={cn("relative aspect-video rounded-lg overflow-hidden bg-black border border-border", !music.current && "hidden")}>
        <div ref={hostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
      </div>

      {panel && <Playlist key="list" music={music} />}
    </div>,
    document.body
  );
}

function Playlist({ music }: { music: MusicData }) {
  const [link, setLink] = useState("");
  const [naming, setNaming] = useState<{ videoId: string; full: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = parseVideoId(link);
    if (!videoId) { setError("That doesn't look like a YouTube video link."); return; }
    if (music.tracks.some(t => t.video_id === videoId)) { setError("That track is already in your playlist."); return; }
    setBusy(true);
    setError(null);
    let full = "";
    try {
      const res = await fetch(`/api/youtube-title?id=${videoId}`);
      if (res.ok) full = (await res.json()).title ?? "";
    } catch { /* name it yourself */ }
    setBusy(false);
    setNaming({ videoId, full, name: full ? shortTitle(full) : "" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naming || !naming.name.trim()) return;
    setBusy(true);
    try {
      await music.addTrack(naming.videoId, naming.name.trim());
      setNaming(null);
      setLink("");
    } catch (err) {
      console.error("Failed to add track:", err);
      setError("Couldn't save that track.");
    }
    setBusy(false);
  };

  return (
    <>
      <div className="flex flex-col max-h-60 overflow-y-auto">
        {music.tracks.map(t => {
          const on = music.current?.id === t.id;
          return (
            <div
              key={t.id}
              onClick={() => (on ? music.toggle() : music.play(t.id))}
              className={cn("group flex items-center justify-between gap-3 px-2 py-2 rounded-md cursor-pointer", on ? "bg-white/[0.07] text-white" : "hover:bg-white/[0.04] text-white/85")}
            >
              <span className="flex items-center gap-2 text-[13px] min-w-0">
                {on ? (music.playing ? <Pause className="w-3 h-3 shrink-0 fill-current" /> : <Play className="w-3 h-3 shrink-0 fill-current" />) : <span className="w-3 shrink-0" />}
                <span className="truncate">{t.title}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-white/40 tabular-nums">{formatLength(t.seconds)}</span>
                <button
                  onClick={e => { e.stopPropagation(); music.deleteTrack(t.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 p-0.5 transition-opacity"
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

      {naming ? (
        <form onSubmit={save} className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
          <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Name it</label>
          <div className="flex gap-2">
            <input
              value={naming.name}
              onChange={e => setNaming({ ...naming, name: e.target.value })}
              autoFocus
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button disabled={busy || !naming.name.trim()} className="px-3 bg-white text-black rounded-lg text-[10px] uppercase tracking-widest font-bold disabled:opacity-50">Save</button>
          </div>
          {naming.full && <span className="text-[11px] text-white/30 truncate">YouTube: {naming.full}</span>}
        </form>
      ) : (
        <form onSubmit={lookUp} className="flex gap-2">
          <input
            value={link}
            onChange={e => { setLink(e.target.value); setError(null); }}
            placeholder="Paste a YouTube link"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/25"
          />
          <button disabled={busy || !link.trim()} className="px-3 bg-white text-black rounded-lg text-[10px] uppercase tracking-widest font-bold disabled:opacity-50">Add</button>
        </form>
      )}
      {error && <p className="text-[11px] text-red-400/80 px-1">{error}</p>}
    </>
  );
}
