"use client";

import React, { useState, useEffect } from "react";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const USERS = {
  Eryk: "erykpawluk@gmail.com",
  Alex: "alexandra.ap.archive@gmail.com"
};

type Identity = "Eryk" | "Alex" | null;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [identity, setIdentity] = useState<Identity>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity) return;
    
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: USERS[identity], 
        password 
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[100] p-4 text-white">
        <div className="w-full max-w-sm flex flex-col items-center">
          
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-md">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-[0.3em] uppercase">System Login</h1>
          </div>

          {!identity ? (
            <div className="flex flex-col gap-4 w-full">
              {(Object.keys(USERS) as Identity[]).map((name) => (
                <button
                  key={name}
                  onClick={() => setIdentity(name)}
                  className="w-full p-4 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-between group"
                >
                  <span>{name}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <button 
                  type="button" 
                  onClick={() => { setIdentity(null); setPassword(""); setError(null); }}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 text-muted-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Authenticating as <span className="text-white font-semibold">{identity}</span>
                </span>
              </div>
              
              <input
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 px-2 py-3 text-white focus:outline-none focus:border-white transition-colors text-center tracking-widest placeholder:text-muted-foreground/50"
                autoFocus
                required
              />
              
              {error && <p className="text-destructive text-xs text-center mt-2">{error}</p>}
              
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full mt-6 py-4 border border-white/10 bg-white text-black font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-white/90 transition-colors",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? "Decrypting..." : "Access OS"}
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  return <>{children}</>;
}
