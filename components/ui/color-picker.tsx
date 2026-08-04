"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";

const COLORS = [
  { name: "Purple", class: "bg-purple-500" },
  { name: "Blue", class: "bg-blue-500" },
  { name: "Emerald", class: "bg-emerald-500" },
  { name: "Amber", class: "bg-amber-500" },
  { name: "Rose", class: "bg-rose-500" },
  { name: "Cyan", class: "bg-cyan-500" },
  { name: "Zinc", class: "bg-zinc-500" },
];

interface ColorPickerProps {
  selectedColor: string | null;
  onChange: (color: string | null) => void;
  contextName: string;
}

export function ColorPicker({ selectedColor, onChange, contextName }: ColorPickerProps) {
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHex, setCustomHex] = useState("#");
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!contextName) return;
    const saved = localStorage.getItem(`custom_colors_${contextName}`);
    if (saved) {
      try {
        setCustomColors(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, [contextName]);

  const saveCustomColor = (color: string) => {
    if (!color.startsWith("#") || color.length !== 7) return;
    
    if (editingColor) {
      if (customColors.includes(editingColor)) {
        const newColors = customColors.map(c => c === editingColor ? color : c);
        setCustomColors(newColors);
        localStorage.setItem(`custom_colors_${contextName}`, JSON.stringify(newColors));
      }
      setEditingColor(null);
    } else {
      if (!customColors.includes(color) && !COLORS.some(c => c.class === color)) {
        const newColors = [...customColors, color];
        setCustomColors(newColors);
        localStorage.setItem(`custom_colors_${contextName}`, JSON.stringify(newColors));
      }
    }
    onChange(color);
  };

  const deleteCustomColor = (color: string) => {
    const newColors = customColors.filter(c => c !== color);
    setCustomColors(newColors);
    localStorage.setItem(`custom_colors_${contextName}`, JSON.stringify(newColors));
    if (selectedColor === color) {
      onChange(COLORS[0].class);
      setShowCustomInput(false);
      setEditingColor(null);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex gap-1.5 items-center flex-wrap mt-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "w-5 h-5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center bg-transparent shrink-0",
          selectedColor === null ? "border-white scale-110 shadow-lg" : "border-white/10 opacity-50 hover:opacity-100 hover:scale-105"
        )}
      >
        <X className="w-2.5 h-2.5 text-white/50" />
      </button>

      {COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onChange(c.class)}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-all cursor-pointer shrink-0",
            c.class,
            selectedColor === c.class ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
          )}
        />
      ))}
      
      {customColors.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-all cursor-pointer shrink-0",
            selectedColor === hex ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
          )}
          style={{ backgroundColor: hex }}
        />
      ))}

      <button
        type="button"
        onClick={() => {
          if (showCustomInput && !editingColor) {
            setShowCustomInput(false);
          } else {
            setCustomHex("#");
            setEditingColor(null);
            setShowCustomInput(true);
          }
        }}
        className={cn(
          "relative w-5 h-5 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-white/5 shrink-0",
          (showCustomInput && !editingColor) ? "border-white/50" : "border-white/10 hover:border-white/30"
        )}
      >
        <span className="text-[10px] font-bold text-white/50 leading-none mb-0.5">+</span>
      </button>

      {selectedColor && customColors.includes(selectedColor) && !showCustomInput && (
        <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-2 duration-300">
          <button
            type="button"
            onClick={() => {
              setCustomHex(selectedColor);
              setEditingColor(selectedColor);
              setShowCustomInput(true);
            }}
            className="p-1 bg-white/5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
            title="Edit color"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={() => deleteCustomColor(selectedColor)}
            className="p-1 bg-white/5 hover:bg-red-500/20 rounded-md text-white/50 hover:text-red-400 transition-colors"
            title="Delete color"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {showCustomInput && (
        <div className="flex items-center gap-1.5 ml-1 animate-in fade-in slide-in-from-left-2 duration-300 bg-white/5 p-1 rounded-md border border-white/10">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-5 h-5 rounded cursor-pointer border border-white/20 shrink-0 shadow-sm transition-transform hover:scale-105"
                style={{ backgroundColor: customHex.length === 7 && customHex.startsWith("#") ? customHex : "#ffffff" }}
                title="Pick a color visually"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-[#1A1A1D] border-white/10 shadow-2xl rounded-xl" sideOffset={10}>
              <HexColorPicker
                color={customHex.length === 7 && customHex.startsWith("#") ? customHex : "#ffffff"}
                onChange={(newColor) => {
                  setCustomHex(newColor);
                  onChange(newColor);
                }}
              />
            </PopoverContent>
          </Popover>
          
          <input
            type="text"
            value={customHex}
            onChange={(e) => {
              setCustomHex(e.target.value);
              if (e.target.value.length === 7 && e.target.value.startsWith("#")) {
                onChange(e.target.value);
              }
            }}
            placeholder="#Hex"
            className="w-14 bg-transparent border-none px-1 text-[10px] text-white outline-none uppercase"
            maxLength={7}
          />
          <button
            type="button"
            onClick={() => {
              if (customHex.length === 7 && customHex.startsWith("#")) {
                saveCustomColor(customHex);
                setShowCustomInput(false);
              }
            }}
            disabled={customHex.length !== 7 || !customHex.startsWith("#")}
            className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors shrink-0"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
