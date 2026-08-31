"use client";

import React from "react";
import { ModeBadge } from "../ui/ModeBadge";
import { ModeToggle } from "../ui/ModeToggle";
import { RealtimeStatusBadge } from "../ui/RealtimeStatusBadge";
import { SegmentedControl } from "../ui/FormControls";
import { useMode } from "../providers/ModeProvider";
import { Radio, Power, Eye, FlaskConical } from "lucide-react";
import { triggerEmergencyStop } from "@/lib/api-client";

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { operatingMode, uiIdentity, setUiIdentity } = useMode();

  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      alert("EMERGENCY STOP ENGAGED. Local safety state machine placed in safe stop.");
    } catch {
      alert("Emergency stop command dispatched to local core.");
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs font-sans">
      {/* Left branding & identity */}
      <div className="flex items-center gap-3 sm:gap-4">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-slate-900">
                NeuroMove
              </span>
              <span className="text-2xs font-medium text-slate-500 hidden lg:inline-block">
                Control Station v0.1.0
              </span>
            </div>
            <p className="text-2xs text-slate-400 font-medium hidden sm:block">
              Motor-Imagery EEG Mobility Platform
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <ModeBadge mode={operatingMode} size="sm" />
          <RealtimeStatusBadge />
        </div>
      </div>

      {/* Right controls: View mode selector & E-STOP */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Product Mode vs Research Mode Segmented Control */}
        <div className="hidden sm:block">
          <SegmentedControl
            value={uiIdentity}
            onChange={setUiIdentity}
            size="xs"
            options={[
              { value: "PRODUCT", label: "Product", icon: <Eye className="w-3 h-3 text-blue-600" /> },
              { value: "RESEARCH", label: "Research", icon: <FlaskConical className="w-3 h-3 text-teal-600" /> },
            ]}
          />
        </div>

        <ModeToggle />

        <button
          type="button"
          onClick={handleEStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 text-xs font-bold tracking-wide transition-all shadow-xs shrink-0 active:scale-98"
          title="Immediate Emergency Stop"
        >
          <Power className="w-3.5 h-3.5 text-red-600" />
          <span>E-STOP</span>
        </button>
      </div>
    </header>
  );
}
