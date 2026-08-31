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
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            EEG Signal Stream & Spectral Power
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
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
          title="EEG Source Inactive (SIMULATION Mode)"
          description="Phase 02 canonical contracts active. Synthetic stream generator and hardware links will connect in future streaming phases."
          icon={<Waves className="w-6 h-6 text-blue-600" />}
        />
      </SectionCard>

      <SectionCard
        title="Spectral Power (Mu: 8-12 Hz / Beta: 16-24 Hz)"
        description="Sensorimotor rhythm Event-Related Desynchronization (ERD) spectral metrics"
      >
        <EmptyState
          title="Spectral Transformer Ready"
          description="Real-time Welch PSD bandpass and FFT decomposition awaiting active epoch stream."
          icon={<Cpu className="w-6 h-6 text-teal-600" />}
        />
      </SectionCard>
    </div>
  );
}
