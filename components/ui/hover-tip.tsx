"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";

interface Tip {
  text: string;
  x: number;
  y: number;
}

/**
 * The small dark pop-up that follows the pointer over a bar or chart mark.
 * Spread `bind(text)` onto the element, and render `layer` once.
 * Text can use "\n" for extra lines.
 */
export function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const bind = (text: string) => ({
    onPointerMove: (e: React.PointerEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onPointerLeave: () => setTip(null),
  });

  // Portalled so blur/transform on parents can't offset it. Flips to the
  // left of the pointer near the right edge, and below it near the top.
  const layer = tip
    ? createPortal(
        <div
          role="tooltip"
          className="fixed z-[300] pointer-events-none whitespace-pre-line bg-[#1c1c1c] border border-white/20 rounded-lg px-2.5 py-2 text-xs leading-relaxed text-white tabular-nums shadow-lg shadow-black/50"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(${tip.x > window.innerWidth - 220 ? "calc(-100% - 14px)" : "14px"}, ${tip.y < 90 ? "16px" : "calc(-100% - 10px)"})`,
          }}
        >
          {tip.text}
        </div>,
        document.body
      )
    : null;

  return { bind, layer };
}
