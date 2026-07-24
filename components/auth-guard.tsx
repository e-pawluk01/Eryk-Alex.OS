"use client";

import React, { useState, useEffect } from "react";
import { Lock } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("task-os-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "420") {
      localStorage.setItem("task-os-auth", "true");
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword("");
    }
  };

  if (isAuthenticated === null) return null; // loading

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[100]">
        <div className="w-full max-w-sm p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-8 h-8 text-muted-foreground" />
            <h1 className="text-2xl font-medium tracking-widest text-foreground">TASK OS</h1>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {error && <p className="text-destructive text-sm text-center">Incorrect password.</p>}
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
