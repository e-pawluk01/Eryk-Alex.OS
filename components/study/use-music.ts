"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface StudyTrack {
  id: string;
  person: string;
  video_id: string;
  title: string;
  seconds: number | null; // filled in the first time it plays
  created_at: string;
}

// The bits of YouTube's player we use.
export interface YTPlayer {
  loadVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  getDuration(): number;
}

/** The study playlist and what's playing. The player itself lives in MusicPlayer. */
export function useMusic(person: string | null) {
  const [tracks, setTracks] = useState<StudyTrack[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    if (!person) return;
    supabase.from("study_tracks").select("*").eq("person", person).order("created_at").then(({ data, error }) => {
      if (error) console.error("Failed to load playlist:", error);
      else setTracks(data as StudyTrack[]);
    });
  }, [person]);

  const current = tracks.find(t => t.id === currentId) ?? null;

  const play = useCallback((id: string) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    setCurrentId(id);
    setPlaying(true);
    playerRef.current?.loadVideoById(track.video_id);
  }, [tracks]);

  const toggle = useCallback(() => {
    if (!current) { if (tracks[0]) play(tracks[0].id); return; }
    if (playing) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
    setPlaying(!playing);
  }, [current, playing, tracks, play]);

  const stop = useCallback(() => {
    playerRef.current?.stopVideo();
    setPlaying(false);
    setCurrentId(null);
  }, []);

  /** When a track ends, carry on with the next one in the list. */
  const next = useCallback(() => {
    if (!tracks.length || !currentId) return;
    const i = tracks.findIndex(t => t.id === currentId);
    play(tracks[(i + 1) % tracks.length].id);
  }, [tracks, currentId, play]);

  const addTrack = useCallback(async (videoId: string, title: string) => {
    const { data, error } = await supabase.from("study_tracks").insert({ person, video_id: videoId, title }).select().single();
    if (error) throw error;
    setTracks(prev => [...prev, data as StudyTrack]);
  }, [person]);

  const deleteTrack = useCallback(async (id: string) => {
    if (id === currentId) stop();
    setTracks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("study_tracks").delete().eq("id", id);
    if (error) console.error("Failed to remove track:", error);
  }, [currentId, stop]);

  const saveLength = useCallback(async (id: string, seconds: number) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, seconds } : t));
    await supabase.from("study_tracks").update({ seconds }).eq("id", id);
  }, []);

  return { tracks, current, playing, setPlaying, open, setOpen, play, toggle, stop, next, addTrack, deleteTrack, saveLength, playerRef };
}

export type MusicData = ReturnType<typeof useMusic>;
