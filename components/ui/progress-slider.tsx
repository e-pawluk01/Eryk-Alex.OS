"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProgressSliderProps {
  progress: number; // 0 to 100
  colorClass?: string | null;
  onChange: (progress: number) => void;
  onDragEnd: (finalProgress: number) => void;
}

export function ProgressSlider({ progress, colorClass, onChange, onDragEnd }: ProgressSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);

  // Sync with external progress when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalProgress(progress);
    }
  }, [progress, isDragging]);

  const calculateProgress = (e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    let clientX = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent | MouseEvent).clientX;
    }
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 100);
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const newProgress = calculateProgress(e);
    setLocalProgress(newProgress);
    onChange(newProgress);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const newProgress = calculateProgress(e);
      setLocalProgress(newProgress);
      onChange(newProgress);
    };

    const handleEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      onDragEnd(localProgress);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, onChange, onDragEnd, localProgress]);

  return (
    <div 
      className="w-full h-1.5 bg-white/10 rounded-full relative cursor-pointer group mt-3 mb-1"
      ref={trackRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={e => e.stopPropagation()}
    >
      <div 
        className={cn("absolute left-0 top-0 bottom-0 rounded-full transition-all duration-75", colorClass || "bg-white")}
        style={{ width: `${localProgress}%` }}
      />
      <div 
        className={cn("absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border border-black/20 opacity-0 group-hover:opacity-100 transition-opacity")}
        style={{ left: `calc(${localProgress}% - 6px)` }}
      />
    </div>
  );
}
