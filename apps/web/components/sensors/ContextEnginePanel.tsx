"use client";

import React from "react";
import { Brain, Eye, Move, Zap, Heart, ShieldCheck, AlertOctagon } from "lucide-react";
import type { MultimodalContext } from "@neuromove/contracts";

interface ContextEnginePanelProps {
  context: MultimodalContext | null;
}

export const ContextEnginePanel: React.FC<ContextEnginePanelProps> = ({ context }) => {
  const motionState = context?.motion_state ?? "STATIONARY";
  const motionContam = context?.motion_contamination_state ?? "MOTION_QUIET";
  const peripheralActive = context?.peripheral_activation ?? false;
  const ocularDetected = context?.ocular_artifact_detected ?? false;
  const contactPresent = context?.contact_present ?? true;
  const pulseBpm = context?.pulse_bpm ?? null;
  const isMovementValid = context?.is_movement_valid ?? true;
  const isEegContaminated = context?.is_eeg_contaminated ?? false;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-slate-100">Neurophysiology Context Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time context state machine evaluating physical movement, ocular contamination, peripheral activation, and subject presence.
          </p>
        </div>

        <div>
          {isMovementValid ? (
            <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> CONTEXT VALID
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              <AlertOctagon className="w-3.5 h-3.5" /> CONTEXT INVALIDATED
            </span>
          )}
        </div>
      </div>

      {/* Context State Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Motion State */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Move className="w-3.5 h-3.5 text-amber-400" /> Motion State
          </div>
          <div className={`text-base font-bold font-mono ${motionState === "STATIONARY" ? "text-emerald-400" : "text-amber-400"}`}>
            {motionState}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {motionContam}
          </div>
        </div>

        {/* Ocular Blink Artifact */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Eye className="w-3.5 h-3.5 text-pink-400" /> Ocular Blink
          </div>
          <div className={`text-base font-bold font-mono ${ocularDetected ? "text-pink-400" : "text-slate-300"}`}>
            {ocularDetected ? "BLINK DETECTED" : "QUIET"}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {isEegContaminated ? "EEG Contaminated" : "Clean Window"}
          </div>
        </div>

        {/* EMG Peripheral Activation */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-emerald-400" /> Peripheral EMG
          </div>
          <div className={`text-base font-bold font-mono ${peripheralActive ? "text-emerald-400" : "text-slate-300"}`}>
            {peripheralActive ? "ACTIVE BURST" : "RESTING"}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Peripheral motor confirmation
          </div>
        </div>

        {/* Seating / Contact Presence */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Heart className="w-3.5 h-3.5 text-rose-400" /> Seating / Contact
          </div>
          <div className={`text-base font-bold font-mono ${contactPresent ? "text-emerald-400" : "text-rose-400"}`}>
            {contactPresent ? "SEATED / ENGAGED" : "UNSEATED"}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {pulseBpm ? `Heart Rate: ${pulseBpm} BPM` : "Pressure verified"}
          </div>
        </div>
      </div>
    </div>
  );
};
