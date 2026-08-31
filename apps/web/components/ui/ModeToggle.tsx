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
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium tracking-wide transition-all shadow-xs",
        uiIdentity === "RESEARCH"
          ? "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100/70 font-semibold"
          : "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100/70 font-semibold",
      )}
      title="Toggle between Product Overview and Research Engineering Mode"
    >
      {uiIdentity === "RESEARCH" ? (
        <>
          <Microscope className="w-3.5 h-3.5 text-teal-600" />
          <span>RESEARCH MODE</span>
        </>
      ) : (
        <>
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>PRODUCT MODE</span>
        </>
      )}
    </button>
  );
}
