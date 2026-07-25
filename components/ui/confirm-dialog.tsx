"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
}

export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = "Delete", 
  cancelText = "Cancel",
  variant = "danger" 
}: ConfirmDialogProps) {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative bg-zinc-950/90 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-sm shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 overflow-hidden flex flex-col items-center p-8 text-center">
        
        {/* Glow behind icon */}
        <div className={cn(
          "absolute top-8 w-24 h-24 rounded-full blur-3xl -z-10 opacity-30",
          variant === "danger" ? "bg-red-500" : "bg-yellow-500"
        )} />

        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mb-6 border",
          variant === "danger" ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
        )}>
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          {description}
        </p>

        <div className="flex w-full gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-white/10 hover:bg-white/5 text-white/70 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]",
              variant === "danger" ? "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "bg-yellow-500 text-black hover:bg-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
            )}
          >
            {confirmText}
          </button>
        </div>
        
        {/* Close Button top right */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors">
          <X className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
