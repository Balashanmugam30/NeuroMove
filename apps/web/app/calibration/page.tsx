"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Crosshair } from "lucide-react";

export default function CalibrationPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            BCI Calibration & Cue Protocol
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
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
          title="Calibration Module Ready"
          description="Canonical Trial and Session contracts established. Interactive trial runners and visual cue engines will be engaged in the calibration phase."
          icon={<Crosshair className="w-6 h-6 text-amber-600" />}
          action={
            <button
              disabled
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold border border-slate-200 cursor-not-allowed"
            >
              Start Calibration Protocol
            </button>
          }
        />
      </SectionCard>
    </div>
  );
}
