"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OperatingMode } from "@neuromove/contracts";

export type UIIdentityMode = "PRODUCT" | "RESEARCH";

interface ModeContextType {
  operatingMode: OperatingMode;
  setOperatingMode: (mode: OperatingMode) => void;
  uiIdentity: UIIdentityMode;
  setUiIdentity: (identity: UIIdentityMode) => void;
  toggleUiIdentity: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [operatingMode, setOperatingMode] =
    useState<OperatingMode>("SIMULATION");
  const [uiIdentity, setUiIdentity] = useState<UIIdentityMode>("PRODUCT");

  const toggleUiIdentity = () => {
    setUiIdentity((prev) => (prev === "PRODUCT" ? "RESEARCH" : "PRODUCT"));
  };

  return (
    <ModeContext.Provider
      value={{
        operatingMode,
        setOperatingMode,
        uiIdentity,
        setUiIdentity,
        toggleUiIdentity,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
