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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-slate-900">Neurophysiology Context Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time context state machine evaluating physical movement, ocular contamination, peripheral activation, and subject presence.
          </p>
        </div>

        <div>
          {isMovementValid ? (
            <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> CONTEXT VALID
            </span>
          ) : (
            <span className="flex items-center gap-1 text-2xs font-mono font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" /> CONTEXT INVALIDATED
            </span>
          )}
        </div>
      </div>

      {/* Context State Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Motion State */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-3xs font-mono font-bold text-slate-500 uppercase">
            <Move className="w-3.5 h-3.5 text-amber-600" /> Motion State
          </div>
          <div className={`text-base font-bold font-mono ${motionState === "STATIONARY" ? "text-emerald-700" : "text-amber-700"}`}>
            {motionState}
          </div>
          <div className="text-2xs font-mono text-slate-500">
            {motionContam}
          </div>
        </div>

        {/* Ocular Blink Artifact */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-3xs font-mono font-bold text-slate-500 uppercase">
            <Eye className="w-3.5 h-3.5 text-pink-600" /> Ocular Blink
          </div>
          <div className={`text-base font-bold font-mono ${ocularDetected ? "text-pink-700 font-bold" : "text-slate-800"}`}>
            {ocularDetected ? "BLINK DETECTED" : "QUIET"}
          </div>
          <div className="text-2xs font-mono text-slate-500">
            {isEegContaminated ? "EEG Contaminated" : "Clean Window"}
          </div>
        </div>

        {/* EMG Peripheral Activation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-3xs font-mono font-bold text-slate-500 uppercase">
            <Zap className="w-3.5 h-3.5 text-emerald-600" /> Peripheral EMG
          </div>
          <div className={`text-base font-bold font-mono ${peripheralActive ? "text-emerald-700 font-bold" : "text-slate-800"}`}>
            {peripheralActive ? "ACTIVE BURST" : "RESTING"}
          </div>
          <div className="text-2xs font-mono text-slate-500">
            Peripheral motor confirmation
          </div>
        </div>

        {/* Seating / Contact Presence */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-3xs font-mono font-bold text-slate-500 uppercase">
            <Heart className="w-3.5 h-3.5 text-rose-600" /> Seating / Contact
          </div>
          <div className={`text-base font-bold font-mono ${contactPresent ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}`}>
            {contactPresent ? "SEATED / ENGAGED" : "UNSEATED"}
          </div>
          <div className="text-2xs font-mono text-slate-500">
            {pulseBpm ? `Heart Rate: ${pulseBpm} BPM` : "Pressure verified"}
          </div>
        </div>
      </div>
    </div>
  );
};
