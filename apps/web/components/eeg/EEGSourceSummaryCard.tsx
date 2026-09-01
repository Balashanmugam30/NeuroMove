"use client";

import React from "react";
import { Waves, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EEGSourceSummaryCardProps {
  sourceKind?: "SYNTHETIC" | "RECORDED" | "HARDWARE";
  mode?: "SIMULATION" | "REPLAY" | "LIVE";
  channels?: string[];
  sampleRateHz?: number;
  connectionState?: string;
  className?: string;
}

export function EEGSourceSummaryCard({
  sourceKind = "SYNTHETIC",
  mode = "SIMULATION",
  channels = ["C3", "Cz", "C4"],
  sampleRateHz = 250,
  connectionState = "CONNECTED",
  className,
}: EEGSourceSummaryCardProps) {
  const isConnected = connectionState === "CONNECTED" || connectionState === "STREAMING";

  return (
    <div
      data-testid="eeg-source-card"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
            <Waves className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Electrophysiology Source
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 font-mono">
                {sourceKind === "SYNTHETIC" ? "SYNTHETIC EEG" : sourceKind}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
                {mode}
              </span>
            </div>
          </div>
        </div>

        {/* Transport Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )}
          />
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
            {connectionState}
          </span>
        </div>
      </div>

      {/* Primary Technical Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            Adapter
          </span>
          <span className="text-xs font-bold text-slate-900 font-mono mt-0.5 block">
            Deterministic Sim
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            Topology
          </span>
          <span className="text-xs font-bold text-slate-900 font-mono mt-0.5 block">
            {channels.join(" / ")}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            Sampling Rate
          </span>
          <span className="text-xs font-bold text-teal-700 font-mono mt-0.5 block">
            {sampleRateHz} Hz
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-2xs font-medium text-slate-500 block">
            Nyquist Limit
          </span>
          <span className="text-xs font-bold text-slate-700 font-mono mt-0.5 block">
            {sampleRateHz / 2} Hz
          </span>
        </div>
      </div>

      {/* Scientific Transparency Notice */}
      <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-2xs text-slate-500">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-700">Scientific Attribution: </span>
          Signal is produced by mathematical simulation with SMR modulation (Seed 42) for
          pipeline verification. Does NOT represent human participant recording or clinical electrophysiology.
        </div>
      </div>
    </div>
  );
}
