"use client";

import React, { useEffect, useRef, useState } from "react";

interface TimeFieldProps {
  id: string;
  value: string; // "HH:mm"
  onChange: (value: string) => void;
}

const pad = (n: number) => n.toString().padStart(2, "0");

// Typed HH : MM box — exact to the minute, no wheel or pop-up.
// Two digits in the hour box jump to minutes; arrow keys nudge.
export function TimeField({ id, value, onChange }: TimeFieldProps) {
  const [hours, setHours] = useState(value.split(":")[0] ?? "");
  const [minutes, setMinutes] = useState(value.split(":")[1] ?? "");
  const minutesRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Follow outside changes (e.g. the dialog resetting) without fighting typing.
  useEffect(() => {
    const [h, m] = value.split(":");
    setHours((cur) => (cur !== "" && pad(Math.min(23, Number(cur))) === h ? cur : h));
    setMinutes((cur) => (cur !== "" && pad(Math.min(59, Number(cur))) === m ? cur : m));
  }, [value]);

  const emit = (h: string, m: string) => {
    if (h === "" || m === "") return;
    onChange(`${pad(Math.min(23, Number(h)))}:${pad(Math.min(59, Number(m)))}`);
  };

  const handleInput = (part: "h" | "m", raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (part === "h") {
      setHours(digits);
      if (digits.length === 2) minutesRef.current?.focus();
      emit(digits, minutes);
    } else {
      setMinutes(digits);
      emit(hours, digits);
    }
  };

  const tidy = (part: "h" | "m") => {
    const [vh, vm] = value.split(":");
    if (part === "h") setHours(hours === "" ? vh : pad(Math.min(23, Number(hours))));
    else setMinutes(minutes === "" ? vm : pad(Math.min(59, Number(minutes))));
  };

  const handleKeyDown = (part: "h" | "m", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const max = part === "h" ? 24 : 60;
      const step = e.key === "ArrowUp" ? 1 : -1;
      const next = pad(((Number(part === "h" ? hours : minutes) || 0) + step + max) % max);
      if (part === "h") { setHours(next); emit(next, minutes); }
      else { setMinutes(next); emit(hours, next); }
    }
    if (part === "h" && e.key === ":") { e.preventDefault(); minutesRef.current?.focus(); }
    if (part === "m" && e.key === "Backspace" && minutes === "") { e.preventDefault(); hoursRef.current?.focus(); }
  };

  const inputClass =
    "w-[2.4ch] bg-transparent border-0 outline-none py-2.5 text-sm text-center text-white/90 tabular-nums rounded focus:bg-white/10";

  return (
    <div className="flex items-center gap-0.5 bg-black/40 border border-white/10 rounded-lg px-2.5 focus-within:border-white/30 transition-colors">
      <input
        id={id}
        ref={hoursRef}
        inputMode="numeric"
        maxLength={2}
        autoComplete="off"
        aria-label="Hours"
        value={hours}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleInput("h", e.target.value)}
        onBlur={() => tidy("h")}
        onKeyDown={(e) => handleKeyDown("h", e)}
        className={inputClass}
      />
      <span className="text-sm text-muted-foreground/50">:</span>
      <input
        ref={minutesRef}
        inputMode="numeric"
        maxLength={2}
        autoComplete="off"
        aria-label="Minutes"
        value={minutes}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleInput("m", e.target.value)}
        onBlur={() => tidy("m")}
        onKeyDown={(e) => handleKeyDown("m", e)}
        className={inputClass}
      />
    </div>
  );
}
