"use client";

import React, { useState, useEffect } from "react";
import { ContextType, Video } from "@/lib/types";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NewVideoDialogProps {
  contextName: ContextType;
  onVideoAdded: (video: Video) => void;
}

const COLORS = [
  { name: "Purple", class: "bg-purple-500", shadow: "shadow-[0_0_10px_rgba(168,85,247,0.2)]" },
  { name: "Blue", class: "bg-blue-500", shadow: "shadow-[0_0_10px_rgba(59,130,246,0.2)]" },
  { name: "Emerald", class: "bg-emerald-500", shadow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
  { name: "Amber", class: "bg-amber-500", shadow: "shadow-[0_0_10px_rgba(245,158,11,0.2)]" },
  { name: "Rose", class: "bg-rose-500", shadow: "shadow-[0_0_10px_rgba(244,63,94,0.2)]" },
  { name: "Cyan", class: "bg-cyan-500", shadow: "shadow-[0_0_10px_rgba(6,182,212,0.2)]" },
];

export function NewVideoDialog({ contextName, onVideoAdded }: NewVideoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].class);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHex, setCustomHex] = useState("#");
  const [editingColor, setEditingColor] = useState<string | null>(null);

  useEffect(() => {
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
  };

  const deleteCustomColor = (color: string) => {
    const newColors = customColors.filter(c => c !== color);
    setCustomColors(newColors);
    localStorage.setItem(`custom_colors_${contextName}`, JSON.stringify(newColors));
    if (selectedColor === color) {
      setSelectedColor(COLORS[0].class);
      setShowCustomInput(false);
      setEditingColor(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tag.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newVideo = {
        title: title.trim(),
        context: contextName,
        tag: tag.trim(),
        color: selectedColor,
        stage: "idea",
      };

      const { data, error } = await supabase.from("videos").insert([newVideo]).select().single();
      if (error) throw error;
      
      if (selectedColor.startsWith("#")) {
        saveCustomColor(selectedColor);
      }

      onVideoAdded(data as Video);
      setIsOpen(false);
      setTitle("");
      setTag("");
      setShowCustomInput(false);
      setCustomHex("#");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center mt-2 mx-auto cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Add Video for {contextName}</span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-6">
              
              <input 
                type="text" 
                placeholder="What video do you want to make?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20"
                disabled={isSubmitting}
              />

              <div className="flex flex-col gap-5">
                
                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Tag (e.g. Tutorial, Vlog)
                  </label>
                  <input 
                    type="text"
                    placeholder="Video title..."
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="bg-transparent border-b border-white/5 pb-2 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all w-full"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30">
                    Tag Color
                  </label>
                  <div className="flex gap-3 items-center flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.class)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all cursor-pointer",
                          c.class,
                          selectedColor === c.class ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                        )}
                      />
                    ))}
                    
                    {customColors.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setSelectedColor(hex)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all cursor-pointer",
                          selectedColor === hex ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
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
                        "relative w-6 h-6 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-white/5",
                        (showCustomInput && !editingColor) ? "border-white/50" : "border-white/10 hover:border-white/30"
                      )}
                    >
                      <span className="text-[10px] font-bold text-white/50 leading-none mb-0.5">+</span>
                    </button>

                    {customColors.includes(selectedColor) && !showCustomInput && (
                      <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-2 duration-300">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomHex(selectedColor);
                            setEditingColor(selectedColor);
                            setShowCustomInput(true);
                          }}
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
                          title="Edit color"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomColor(selectedColor)}
                          className="p-1.5 bg-white/5 hover:bg-red-500/20 rounded-md text-white/50 hover:text-red-400 transition-colors"
                          title="Delete color"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {showCustomInput && (
                      <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2 duration-300 bg-white/5 p-1 rounded-md border border-white/10">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-6 h-6 rounded cursor-pointer border border-white/20 shrink-0 shadow-sm transition-transform hover:scale-105"
                              style={{ backgroundColor: customHex.length === 7 && customHex.startsWith("#") ? customHex : "#ffffff" }}
                              title="Pick a color visually"
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3 bg-[#1A1A1D] border-white/10 shadow-2xl rounded-xl" sideOffset={10}>
                            <HexColorPicker
                              color={customHex.length === 7 && customHex.startsWith("#") ? customHex : "#ffffff"}
                              onChange={(newColor) => {
                                setCustomHex(newColor);
                                setSelectedColor(newColor);
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
                              setSelectedColor(e.target.value);
                            }
                          }}
                          placeholder="#Hex"
                          className="w-16 bg-transparent border-none px-1 text-xs text-white outline-none uppercase"
                          maxLength={7}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customHex.length === 7 && customHex.startsWith("#")) {
                              saveCustomColor(customHex);
                              setSelectedColor(customHex);
                              setShowCustomInput(false);
                            }
                          }}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ml-1"
                        >
                          {editingColor ? "Save" : "Add"}
                        </button>
                        {editingColor && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomInput(false);
                              setEditingColor(null);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold uppercase tracking-widest transition-colors text-white/50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="mt-2 flex justify-end">
                <button 
                  type="submit"
                  disabled={!title.trim() || !tag.trim() || isSubmitting}
                  className="px-6 py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                >
                  Create Video
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
