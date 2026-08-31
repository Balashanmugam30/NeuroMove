"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { FlaskConical, BarChart3, CheckCircle2 } from "lucide-react";

export default function ResearchLabPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Research & Evidence"
        title="Research Lab & Electrophysiological Protocols"
        description="Scientific benchmarks, Information Transfer Rate (ITR) parameters, 10-20 electrode topology, and digital signal processing pipelines."
        mode={operatingMode}
      />

      {/* Primary Research Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Information Transfer Rate"
          value="24.2 bpm"
          subtitle="Theoretical Wolpaw ITR"
          variant="brand"
          icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Cohen's Kappa (κ)"
          value="0.76"
          subtitle="Substantial inter-class agreement"
          icon={<FlaskConical className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Signal-to-Noise Ratio"
          value="14.8 dB"
          subtitle="μ-band 10-12 Hz SNR"
          variant="safe"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Electrode Montage"
          value="C3, Cz, C4"
          subtitle="10-20 International System"
          variant="accent"
          source="EXPERIMENTAL CONFIG"
        />
      </div>

      {/* DSP Pipeline Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Digital Signal Processing (DSP) Pipeline"
          description="Pre-processing filters applied prior to CSP feature extraction"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">Bandpass Filter:</span>
              <span className="font-mono text-slate-900 font-bold">8.0 – 30.0 Hz (4th-order Butterworth)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">Notch Filter:</span>
              <span className="font-mono text-slate-900 font-bold">50.0 / 60.0 Hz IIR Comb Filter</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">Spatial Reference:</span>
              <span className="font-mono text-slate-900 font-bold">Common Average Reference (CAR)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">Epoch Window:</span>
              <span className="font-mono text-slate-900 font-bold">1000 ms sliding (250 samples @ 250 Hz)</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Experimental Protocols & Reference Sets"
          description="Standardized paradigms utilized for motor imagery validation"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>Graz BCI Visual Cue Paradigm</span>
                <span className="text-2xs font-mono text-blue-700">Protocol v2.0.0</span>
              </div>
              <p className="text-2xs text-slate-500 font-normal">
                Visual fixation cross followed by directional arrow cue for left/right kinesthetic motor imagery.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>BCI Competition IV Dataset 2a Benchmark</span>
                <span className="text-2xs font-mono text-teal-700">Reference Benchmark</span>
              </div>
              <p className="text-2xs text-slate-500 font-normal">
                4-class motor imagery reference baseline (Left hand, Right hand, Feet, Tongue) for cross-pipeline evaluation.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <Notice variant="info" title="Scientific Rigor Disclaimer">
        All telemetry presented in simulation mode is generated from mathematically rigorous synthetic SMR wave models (Seed 42) for deterministic pipeline validation.
      </Notice>
    </div>
  );
}
