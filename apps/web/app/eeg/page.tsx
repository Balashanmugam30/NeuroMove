"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Waves, Cpu } from "lucide-react";

export default function EEGStreamPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            EEG Signal Stream & Spectral Power
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Raw differential electrophysiological time series and Welch Power
            Spectral Density (PSD).
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Live Oscilloscope & Time-Series Epochs"
        description="High-frequency buffered streaming channels: C3, Cz, C4 (250 Hz)"
      >
        <EmptyState
          title="EEG Source Not Connected"
          description="Phase 01 foundation active in SIMULATION mode. Hardware acquisition stream will be linked in Phase 02."
          icon={<Waves className="w-6 h-6 text-blue-400" />}
        />
      </SectionCard>

      <SectionCard
        title="Spectral Power (Mu: 8-12 Hz / Beta: 16-24 Hz)"
        description="Sensorimotor rhythm Event-Related Desynchronization (ERD) spectral metrics"
      >
        <EmptyState
          title="Spectral Transformer Inactive"
          description="Real-time Welch PSD bandpass and FFT decomposition awaiting active epoch stream."
          icon={<Cpu className="w-6 h-6 text-purple-400" />}
        />
      </SectionCard>
    </div>
  );
}
