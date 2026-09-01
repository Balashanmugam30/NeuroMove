"use client";

import React, { useState } from "react";
import { Sliders, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreprocessingOverviewProps {
  className?: string;
}

export function PreprocessingOverview({ className }: PreprocessingOverviewProps) {
  const [notchSetting, setNotchSetting] = useState<"OFF" | "50Hz" | "60Hz">("OFF");
  const [referenceSetting, setReferenceSetting] = useState<"RAW" | "CAR">("RAW");

  return (
    <div
      data-testid="preprocessing-overview"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
            <Sliders className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              DSP Pipeline Configuration
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Signal Preprocessing & Filtering
            </h3>
          </div>
        </div>

        <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
          BYPASS / RAW
        </span>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {/* High-Pass Filter */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            High-Pass Cutoff
          </span>
          <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
            0.5 Hz (Bypass)
          </span>
          <span className="text-3xs text-slate-400 block mt-1">
            DC drift suppression
          </span>
        </div>

        {/* Low-Pass Filter */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            Low-Pass Cutoff
          </span>
          <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
            40.0 Hz (Bypass)
          </span>
          <span className="text-3xs text-slate-400 block mt-1">
            Anti-aliasing boundary
          </span>
        </div>

        {/* Line Noise Notch Filter Toggle */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-2xs font-medium text-slate-500 block">
              Line-Noise Notch
            </span>
            <div className="flex items-center gap-1 mt-1">
              {(["OFF", "50Hz", "60Hz"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setNotchSetting(opt)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-3xs font-mono font-bold transition-all",
                    notchSetting === opt
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-200/70 text-slate-600 hover:text-slate-900"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <span className="text-3xs text-slate-400 block mt-1">
            Mains interference
          </span>
        </div>

        {/* Spatial Reference */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-2xs font-medium text-slate-500 block">
              Spatial Reference
            </span>
            <div className="flex items-center gap-1 mt-1">
              {(["RAW", "CAR"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setReferenceSetting(opt)}
                  className={cn(
                    "px-2 py-0.5 rounded text-3xs font-mono font-bold transition-all",
                    referenceSetting === opt
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-200/70 text-slate-600 hover:text-slate-900"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <span className="text-3xs text-slate-400 block mt-1">
            Common Average Ref
          </span>
        </div>
      </div>

      {/* Transparency Disclaimer */}
      <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-2xs text-slate-500">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-700">Pipeline Invariant: </span>
          Phase 07 visualizes the raw synthesized electrophysiological potentials. Digital filtering
          (FIR/IIR bandpass and CAR) is introduced in downstream preprocessing phases and will NOT be
          silently applied here.
        </div>
      </div>
    </div>
  );
}
