"use client";

import React, { useState, useEffect } from "react";
import { ContextType, Video } from "@/lib/types";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { parseISO } from "date-fns";

interface EditVideoDialogProps {
  video: Video;
  children: React.ReactNode;
  onVideoUpdated: (id: string, updates: Partial<Video>) => void;
  onVideoDeleted?: (id: string) => void;
}

const COLORS = [
  { name: "Purple", class: "bg-purple-500", shadow: "shadow-[0_0_10px_rgba(168,85,247,0.2)]" },
  { name: "Blue", class: "bg-blue-500", shadow: "shadow-[0_0_10px_rgba(59,130,246,0.2)]" },
  { name: "Emerald", class: "bg-emerald-500", shadow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
  { name: "Amber", class: "bg-amber-500", shadow: "shadow-[0_0_10px_rgba(245,158,11,0.2)]" },
  { name: "Rose", class: "bg-rose-500", shadow: "shadow-[0_0_10px_rgba(244,63,94,0.2)]" },
  { name: "Cyan", class: "bg-cyan-500", shadow: "shadow-[0_0_10px_rgba(6,182,212,0.2)]" },
];

export function EditVideoDialog({ video, children, onVideoUpdated, onVideoDeleted }: EditVideoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [tag, setTag] = useState(video.tag);
  const [selectedContext, setSelectedContext] = useState<ContextType>(video.context);
  const [selectedColor, setSelectedColor] = useState(video.color);
  const [shortsTarget, setShortsTarget] = useState(video.shorts_target || 0);
  const [scheduledDate, setScheduledDate] = useState<Date>(parseISO(video.scheduled_date || format(new Date(), "yyyy-MM-dd")));
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHex, setCustomHex] = useState("#");
  const [editingColor, setEditingColor] = useState<string | null>(null);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setTitle(video.title);
      setTag(video.tag);
      setSelectedContext(video.context);
      setSelectedColor(video.color);
      setShortsTarget(video.shorts_target || 0);
      setScheduledDate(parseISO(video.scheduled_date || format(new Date(), "yyyy-MM-dd")));
    }
  }, [isOpen, video]);

  useEffect(() => {
    const saved = localStorage.getItem(`custom_colors_${video.context}`);
    if (saved) {
      try {
        setCustomColors(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, [video.context]);

  const saveCustomColor = (color: string) => {
    if (!color.startsWith("#") || color.length !== 7) return;
    
    let newColors = [...customColors];
    if (editingColor) {
      newColors = newColors.map(c => c === editingColor ? color : c);
    } else {
      newColors = [...newColors, color];
    }
    
    setCustomColors(newColors);
    localStorage.setItem(`custom_colors_${video.context}`, JSON.stringify(newColors));
    setSelectedColor(color);
    setShowCustomInput(false);
    setEditingColor(null);
  };

  const removeCustomColor = (e: React.MouseEvent, colorToRemove: string) => {
    e.stopPropagation();
    const newColors = customColors.filter(c => c !== colorToRemove);
    setCustomColors(newColors);
    localStorage.setItem(`custom_colors_${video.context}`, JSON.stringify(newColors));
    if (selectedColor === colorToRemove) {
      setSelectedColor(COLORS[0].class);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tag.trim() || !scheduledDate) return;

    setIsSubmitting(true);
    try {
      const updates = {
        title: title.trim(),
        tag: tag.trim(),
        context: selectedContext,
        color: selectedColor,
        shorts_target: shortsTarget,
        scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
      };

      const { error } = await supabase.from("videos").update(updates).eq("id", video.id);
      if (error) throw error;
      
      onVideoUpdated(video.id, updates);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update video:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onVideoDeleted) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("videos").delete().eq("id", video.id);
      if (error) throw error;
      onVideoDeleted(video.id);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to delete video:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Edit Video</span>
              <div className="flex items-center gap-2">
                {onVideoDeleted && (
                  <button 
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="p-1.5 rounded-full hover:bg-red-500/10 text-red-500/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                    placeholder="E.g. Tutorial, Vlog..."
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="bg-transparent border-b border-white/5 pb-2 text-xs text-white/80 outline-none focus:border-white/30 focus:text-white transition-all w-full"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Creator
                  </label>
                  <div className="flex items-center gap-2">
                    {(['Eryk', 'Alex'] as ContextType[]).map(ctx => (
                      <button
                        key={ctx}
                        type="button"
                        onClick={() => setSelectedContext(ctx)}
                        className={cn(
                          "px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest border transition-all",
                          selectedContext === ctx 
                            ? "bg-white/10 text-white border-white/20" 
                            : "bg-transparent text-white/40 border-white/5 hover:border-white/10"
                        )}
                      >
                        {ctx}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Upload Date
                  </label>
                  <DatePicker 
                    date={scheduledDate}
                    onDateSelect={(d) => d && setScheduledDate(d)}
                  />
                </div>

                <div className="flex flex-col gap-2 group">
                  <label className="text-[9px] uppercase tracking-widest font-semibold text-white/30 group-focus-within:text-white/60 transition-colors">
                    Shorts Target
                  </label>
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => setShortsTarget(Math.max(0, shortsTarget - 1))}
                      className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm font-semibold">{shortsTarget}</span>
                    <button 
                      type="button"
                      onClick={() => setShortsTarget(shortsTarget + 1)}
                      className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
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
                          "w-6 h-6 rounded-full border-2 transition-all cursor-pointer relative",
                          selectedColor === hex ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                        )}
                        style={{ backgroundColor: hex }}
                      >
                         <div 
                          className="absolute -top-1 -right-1 bg-black/50 rounded-full p-0.5 opacity-0 hover:opacity-100 transition-opacity"
                          onClick={(e) => removeCustomColor(e, hex)}
                        >
                          <X className="w-2 h-2 text-white" />
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        if (showCustomInput && !editingColor) {
                          setShowCustomInput(false);
                        } else {
                          setCustomHex(selectedColor.startsWith("#") ? selectedColor : "#");
                          setEditingColor(selectedColor.startsWith("#") ? selectedColor : null);
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

              <div className="mt-2 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!title.trim() || !tag.trim() || isSubmitting}
                  className="px-6 py-2.5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
