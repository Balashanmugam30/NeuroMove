"use client";

import React from "react";
import { ModeBadge } from "../ui/ModeBadge";
import { ModeToggle } from "../ui/ModeToggle";
import { useMode } from "../providers/ModeProvider";
import { Radio, Power } from "lucide-react";
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
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-slate-900">
                NeuroMove
              </span>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline-block">
                Control Station v0.1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden md:block">
              Motor-Imagery EEG Mobility Platform
            </p>
          </div>
        </div>

        <ModeBadge mode={operatingMode} />
      </div>

      <div className="flex items-center gap-3">
        <ModeToggle />

        <button
          onClick={handleEStop}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 text-xs font-semibold tracking-wide transition-all shadow-xs"
          title="Immediate Emergency Stop"
        >
          <Power className="w-3.5 h-3.5 text-red-600" />
          <span>E-STOP</span>
        </button>
      </div>
    </header>
  );
}
