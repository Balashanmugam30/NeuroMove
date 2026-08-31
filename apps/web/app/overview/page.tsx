"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { Activity, Cpu, Layers } from "lucide-react";

export default function OverviewPage() {
  const { uiIdentity, operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            System Overview & Pipeline
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            End-to-end motor-imagery EEG acquisition, feature extraction, and
            safety architecture.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Architecture Phase"
          value="02 / 24"
          subtitle="Canonical Domain & Contracts"
          variant="brand"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Active Mode"
          value={operatingMode}
          subtitle="Air-gapped local safety loop"
          variant="safe"
          icon={<Cpu className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="UI Identity"
          value={uiIdentity}
          subtitle="Toggle in top right toolbar"
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        />
      </div>

      <SectionCard
        title="Processing Pipeline Lifecycle"
        description="Sequential stages from raw electrophysiological acquisition to safe wheel actuation"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>Acquisition & DSP</span>
            </div>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              10-20 EEG streaming (C3, Cz, C4), 8–30 Hz bandpass, 50/60 Hz notch
              filtering, Laplacian reference.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>Feature & Classifier</span>
            </div>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Filter Bank CSP spatial filtering + Regularized LDA / SVM
              confidence estimation.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <span>Confirmation Gate</span>
            </div>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Temporal debounce window, Bayesian posterior smoothing, and
              confidence threshold checks.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              <span>Safety Arbitration</span>
            </div>
            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Deterministic state machine verification → APPROVE / BLOCK / STOP
              → ESP32 driver.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
