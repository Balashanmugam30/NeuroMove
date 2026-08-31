"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Award, FileText, CheckCircle2 } from "lucide-react";

export default function ResultsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            Competition Results & Mission Evidence
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Verification logs, trial completion times, false activation rates,
            and Cybathlon compliance reports.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Competition Evidence Dossier"
        description="Audited trial telemetry and mission logs"
      >
        <EmptyState
          title="No Competition Trials Recorded"
          description="Trial evidence logging and replay bundle export mechanisms initialized for Phase 01."
          icon={<Award className="w-6 h-6 text-amber-400" />}
        />
      </SectionCard>
    </div>
  );
}
