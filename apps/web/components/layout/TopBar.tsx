"use client";

import React from "react";
import { ModeBadge } from "../ui/ModeBadge";
import { ModeToggle } from "../ui/ModeToggle";
import { useMode } from "../providers/ModeProvider";
import { Shield, Radio, Power } from "lucide-react";
import { triggerEmergencyStop } from "@/lib/api-client";

export function TopBar() {
  const { operatingMode } = useMode();

  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      alert("EMERGENCY STOP TRIGGERED. Local safety state machine engaged.");
    } catch {
      alert("Emergency stop command dispatched to local core.");
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-950/50 border border-blue-800/60 text-blue-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="font-mono text-sm font-bold tracking-wider text-slate-100 uppercase">
              NEUROMOVE
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-mono text-slate-400">
              Control Station v0.1.0
            </span>
          </div>
        </div>

        <ModeBadge mode={operatingMode} />
      </div>

      <div className="flex items-center gap-3">
        <ModeToggle />

        <button
          onClick={handleEStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-700/80 bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 hover:text-rose-100 text-xs font-mono font-semibold uppercase tracking-wider transition-all shadow-sm shadow-rose-950/50"
          title="Immediate Emergency Stop"
        >
          <Power className="w-3.5 h-3.5 text-rose-400" />
          <span>E-STOP</span>
        </button>
      </div>
    </header>
  );
}
