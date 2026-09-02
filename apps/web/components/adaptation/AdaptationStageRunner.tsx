"use client";

import React from "react";
import { AdaptationRun, AdaptationRunStatus } from "@neuromove/contracts";
import { CheckCircle2, ShieldCheck } from "lucide-react";

interface AdaptationStageRunnerProps {
  currentRun: AdaptationRun | null;
  isResearchMode?: boolean;
}

const STAGES: { key: AdaptationRunStatus; label: string }[] = [
  { key: "PLANNED", label: "Planned" },
  { key: "VALIDATING_DATA", label: "QC & Compatibility" },
  { key: "BUILDING_TRAINING_SET", label: "Zero-Leakage Partition" },
  { key: "TRAINING", label: "CSP Fitting" },
  { key: "VALIDATING", label: "Protected Val" },
  { key: "COMPARING", label: "Regression Guard" },
  { key: "APPROVAL_PENDING", label: "Approval Gate" },
];

export const AdaptationStageRunner: React.FC<AdaptationStageRunnerProps> = ({
  currentRun,
}) => {

  if (!currentRun) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500 shadow-sm">
        No active adaptation execution in progress. Configure parameters above to initiate candidate fitting.
      </div>
    );
  }

  const currentStatus = currentRun.status;
  const isFinished = [
    "APPROVAL_PENDING",
    "PROMOTED",
    "REJECTED",
    "FAILED",
  ].includes(currentStatus);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900 text-sm">
            Adaptation Execution Pipeline
          </h3>
        </div>
        <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          ID: {currentRun.adaptation_id}
        </span>
      </div>

      {/* Pipeline Stage Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">

        {STAGES.map((stg, idx) => {
          const isCurrent = currentStatus === stg.key;
          const isPast = isFinished || idx <= 5;

          return (
            <div
              key={stg.key}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                isCurrent
                  ? "bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 text-blue-900 font-semibold"
                  : isPast
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                Step 0{idx + 1}
              </div>
              <div className="text-xs mt-0.5">{stg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Composition & Invariants Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <span className="text-slate-500 font-medium">Training Composition:</span>
          <div className="font-semibold text-slate-900">
            {currentRun.training_composition.base_retained_count} Retained +{" "}
            {currentRun.training_composition.new_count} New (
            {currentRun.training_composition.total_count} Total)
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <span className="text-slate-500 font-medium">Protected Validation:</span>
          <div className="font-semibold text-slate-900">
            {currentRun.validation_composition.protected_count} Held-out Trials
          </div>
        </div>

        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
          <span className="text-emerald-700 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Zero Data Leakage:
          </span>
          <div className="font-semibold text-emerald-900">
            train ∩ val = 0 overlap ({currentRun.leakage_check.overlap_count} items)
          </div>
        </div>
      </div>
    </div>
  );
};
