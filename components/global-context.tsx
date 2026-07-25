"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type DomainType = "WORK" | "STUDY" | "CONTENT";

interface GlobalContextProps {
  currentDomain: DomainType;
  setCurrentDomain: (domain: DomainType) => void;
  userEmail: string | null;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  const [currentDomain, setCurrentDomain] = useState<DomainType>("WORK");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GlobalContext.Provider value={{ currentDomain, setCurrentDomain, userEmail }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalContextProvider");
  }
  return context;
}
