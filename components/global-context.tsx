"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type ContextType = 
  | "All"
  | "Study (Person A)"
  | "Study (Person B)"
  | "Business 1"
  | "Business 2";

interface GlobalContextProps {
  currentContext: ContextType;
  setCurrentContext: (context: ContextType) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  const [currentContext, setCurrentContext] = useState<ContextType>("All");

  return (
    <GlobalContext.Provider value={{ currentContext, setCurrentContext }}>
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
