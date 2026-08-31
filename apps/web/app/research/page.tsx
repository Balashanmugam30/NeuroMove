"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3, LineChart, Cpu } from "lucide-react";

export default function ResearchPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            Research Analytics & Benchmarks
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Signal-to-noise ratio (SNR), Information Transfer Rate (ITR), and
            cross-session generalization metrics.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Information Transfer Rate (ITR)"
          description="Bits per minute throughput computed across confirmed intent epochs"
        >
          <EmptyState
            title="Awaiting Experimental Trials"
            description="Phase 01 platform foundation active. Benchmark computation pipelines will activate in Phase 03."
            icon={<BarChart3 className="w-6 h-6 text-purple-400" />}
          />
        </SectionCard>

        <SectionCard
          title="ERD / ERS Temporal Dynamics"
          description="Time-frequency event-related desynchronization curves over motor imagery onset"
        >
          <EmptyState
            title="No Trial Epochs Available"
            description="Time-frequency wavelets and Morlet spectrogram computation ready for trial data."
            icon={<LineChart className="w-6 h-6 text-blue-400" />}
          />
        </SectionCard>
      </div>
    </div>
  );
}
