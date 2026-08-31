"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { ModeBadge } from "@/components/ui/ModeBadge";
import {
  Brain,
  ShieldAlert,
  Bot,
  Activity,
  Cpu,
  Layers,
  CheckCircle,
} from "lucide-react";

export default function OverviewPage() {
  const { uiIdentity, operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            System Overview & Pipeline
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            End-to-end motor-imagery EEG acquisition, feature extraction, and
            safety architecture.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Architecture Phase"
          value="01 / 24"
          subtitle="Engineering Platform Foundation"
          icon={<Layers className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          title="Active Mode"
          value={operatingMode}
          subtitle="Air-gapped local safety loop"
          icon={<Cpu className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="UI Identity"
          value={uiIdentity}
          subtitle="Toggle in top right toolbar"
          icon={<Activity className="w-4 h-4 text-purple-400" />}
        />
      </div>

      <SectionCard
        title="Processing Pipeline Lifecycle"
        description="Sequential stages from raw electrophysiological acquisition to safe wheel actuation"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
          <div className="p-4 rounded border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-400">
              <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Acquisition & DSP</span>
            </div>
            <p className="text-xs text-slate-400">
              10-20 EEG streaming ($C_3, C_z, C_4$), 8–30 Hz bandpass, 50/60 Hz
              notch filtering, Laplacian reference.
            </p>
          </div>

          <div className="p-4 rounded border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-400">
              <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Feature & Classifier</span>
            </div>
            <p className="text-xs text-slate-400">
              Filter Bank CSP spatial filtering + Regularized LDA / SVM
              confidence estimation.
            </p>
          </div>

          <div className="p-4 rounded border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
              <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-800 flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Confirmation Gate</span>
            </div>
            <p className="text-xs text-slate-400">
              Temporal debounce window, Bayesian posterior smoothing, and
              confidence threshold checks.
            </p>
          </div>

          <div className="p-4 rounded border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-[10px]">
                4
              </span>
              <span>Safety Arbitration</span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic state machine verification $\to$ APPROVE / BLOCK /
              STOP $\to$ ESP32 driver.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
