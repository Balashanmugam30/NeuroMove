"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

export default function ResultsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Trial Results & Export
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Standardized BCI benchmark datasets, CSV/JSON session exports, and
            reports.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Session Exports & Artifacts"
        description="Download raw signals, extracted bandpass epochs, and arbitration logs"
      >
        <EmptyState
          title="No Exportable Records Found"
          description="Trial results and session records will appear here after calibration and testing sessions are recorded."
          icon={<FileText className="w-6 h-6 text-slate-400" />}
        />
      </SectionCard>
    </div>
  );
}
