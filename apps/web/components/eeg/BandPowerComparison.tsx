"use client";

import React, { useState } from "react";
import { BarChart3, Download, ArrowLeftRight } from "lucide-react";
import { BandPowerResponse } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

interface BandPowerComparisonProps {
  bandData?: BandPowerResponse | null;
  onExport?: () => void;
  className?: string;
}

export function BandPowerComparison({
  bandData,
  onExport,
  className,
}: BandPowerComparisonProps) {
  const [viewMode, setViewMode] = useState<"relative" | "absolute">("relative");

  const bands = [
    { key: "delta", label: "Delta (1-4 Hz)", color: "bg-slate-400" },
    { key: "theta", label: "Theta (4-8 Hz)", color: "bg-amber-500" },
    { key: "mu", label: "Mu / Alpha (8-13 Hz)", color: "bg-blue-600" },
    { key: "beta", label: "Beta (13-30 Hz)", color: "bg-teal-600" },
    { key: "gamma", label: "Gamma (30-45 Hz)", color: "bg-purple-600" },
  ];

  const channels = ["C3", "Cz", "C4"];
  const lateralizationIndex = bandData?.mu_erd_lateralization_index ?? 0.0;

  const getLateralizationState = (idx: number) => {
    if (idx > 0.15) {
      return {
        label: "RIGHT MOTOR INTENT (C3 Contralateral Desynchronization)",
        color: "text-blue-700 bg-blue-50 border-blue-200",
      };
    }
    if (idx < -0.15) {
      return {
        label: "LEFT MOTOR INTENT (C4 Contralateral Desynchronization)",
        color: "text-purple-700 bg-purple-50 border-purple-200",
      };
    }
    return {
      label: "BILATERAL BALANCED / REST",
      color: "text-slate-700 bg-slate-50 border-slate-200",
    };
  };

  const latState = getLateralizationState(lateralizationIndex);

  return (
    <div
      data-testid="band-power-comparison"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 border border-teal-200">
            <BarChart3 className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Sensorimotor Band Decomposition
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Band Power Comparison
              </h3>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                SMR SPECTRUM
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-2xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode("relative")}
              className={cn(
                "px-2.5 py-1 rounded font-bold transition-all",
                viewMode === "relative"
                  ? "bg-white text-teal-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Relative (%)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("absolute")}
              className={cn(
                "px-2.5 py-1 rounded font-bold transition-all",
                viewMode === "absolute"
                  ? "bg-white text-teal-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Absolute (uV^2)
            </button>
          </div>

          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-2xs font-semibold text-slate-700 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Simulated Mu-Band Lateralization Banner */}
      <div className="mt-4 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono bg-slate-50 border-slate-200">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-slate-600" />
          <span className="text-slate-500 font-sans text-2xs">
            Mu Lateralization Index (C4-C3)/(C4+C3):
          </span>
          <span className="font-bold text-slate-900 font-mono">
            {lateralizationIndex > 0 ? `+${lateralizationIndex}` : lateralizationIndex}
          </span>
        </div>

        <span
          className={cn(
            "px-2 py-0.5 rounded border text-3xs font-bold font-sans",
            latState.color
          )}
        >
          {latState.label}
        </span>
      </div>

      {/* Side-by-side Channel Comparison Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {channels.map((ch) => {
          const chBands = bandData?.bands_by_channel?.[ch];

          return (
            <div
              key={ch}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="text-xs font-bold font-mono text-slate-900">
                  Channel {ch}
                </span>
                <span className="text-3xs font-mono text-slate-400">
                  {ch === "C3" ? "Left" : ch === "C4" ? "Right" : "Midline"}
                </span>
              </div>

              <div className="space-y-2 font-mono text-2xs">
                {bands.map((b) => {
                  const item = chBands?.[b.key];
                  const absVal = item?.absolute_power ?? 0;
                  const relVal = item?.relative_power ?? 0;
                  const pct = Math.round(relVal * 100);

                  return (
                    <div key={b.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-sans">{b.label}</span>
                        <span className="font-bold text-slate-800">
                          {viewMode === "relative"
                            ? `${pct}%`
                            : `${absVal.toFixed(1)} uV^2`}
                        </span>
                      </div>
                      {/* Bar fill */}
                      <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", b.color)}
                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
