"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Crosshair, Play } from "lucide-react";

export default function CalibrationPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            BCI Calibration & Cue Protocol
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Standardized Graz visual cue presentation for subject motor imagery
            calibration.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Calibration Session Runner"
        description="Visual cue timing: Fixation cross (2.0s) -> Cue arrow (1.5s) -> Imagery execution (4.0s) -> Rest"
      >
        <EmptyState
          title="Calibration Module Coming Online"
          description="Phase 01 foundation ready. Synchronous trial runners and cue timing engines will be introduced in Phase 02."
          icon={<Crosshair className="w-6 h-6 text-amber-400" />}
          action={
            <button
              disabled
              className="px-4 py-2 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700 cursor-not-allowed"
            >
              Start Calibration (Phase 02)
            </button>
          }
        />
      </SectionCard>
    </div>
  );
}
