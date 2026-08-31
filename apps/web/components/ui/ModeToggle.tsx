"use client";

import React from "react";
import { useMode } from "../providers/ModeProvider";
import { Activity, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { uiIdentity, toggleUiIdentity } = useMode();

  return (
    <button
      onClick={toggleUiIdentity}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono tracking-wider transition-all",
        uiIdentity === "RESEARCH"
          ? "bg-purple-950/40 border-purple-700/60 text-purple-300 hover:bg-purple-900/50"
          : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",
      )}
      title="Toggle between Product Overview and Research Engineering Mode"
    >
      {uiIdentity === "RESEARCH" ? (
        <>
          <Microscope className="w-3.5 h-3.5 text-purple-400" />
          <span>RESEARCH MODE</span>
        </>
      ) : (
        <>
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>PRODUCT MODE</span>
        </>
      )}
    </button>
  );
}
