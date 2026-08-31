"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";

export default function ResearchLabPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Research Lab & Analytics
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Information Transfer Rate (ITR), confusion matrices, and CSP spatial
            topographies.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Scientific Analytics & ITR"
        description="Offline statistical metrics, ROC curves, and cross-subject benchmark comparisons"
      >
        <EmptyState
          title="Analytical Metrics Ready"
          description="Canonical Experiment, ModelArtifact, and Trial contracts defined. Scientific analytics and benchmarks will be generated upon dataset calibration."
          icon={<BarChart3 className="w-6 h-6 text-teal-600" />}
        />
      </SectionCard>
    </div>
  );
}
