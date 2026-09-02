"use client";

import React from "react";
import { FaultExperiment } from "@neuromove/contracts";

interface ExperimentTimelineProps {
  experiment: FaultExperiment | null;
}

export function ExperimentTimeline({ experiment }: ExperimentTimelineProps) {
  if (!experiment) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Experiment Execution Timeline</h3>
        <p className="text-xs text-slate-500 mb-6">Step-by-step visual audit trail of the failure and recovery lifecycle</p>
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
          No experiment currently selected. Run a scenario or select a historical experiment to view its timeline.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Execution Audit Timeline</h3>
          <p className="text-xs text-slate-500">
            Experiment {experiment.experiment_id} ({experiment.name})
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            Seed: {experiment.seed}
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            {experiment.duration_ms.toFixed(1)}ms
          </span>
        </div>
      </div>

      <div className="mt-6 relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {/* Step 1: Baseline Checkpoint */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-[10px] font-bold text-blue-700">
            1
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span>Baseline Checkpoint Captured</span>
              <span className="text-[10px] font-mono text-slate-400">
                State: {experiment.baseline_snapshot.current_safety_state}
              </span>
            </div>
            <p className="text-slate-600 mt-1">
              Deterministic recovery checkpoint created. Authorization before failure:{" "}
              <strong className={experiment.authorization_before_failure ? "text-amber-700" : "text-slate-700"}>
                {String(experiment.authorization_before_failure)}
              </strong>
            </p>
          </div>
        </div>

        {/* Step 2: Fault Injection Sequence */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-100 border-2 border-amber-600 flex items-center justify-center text-[10px] font-bold text-amber-700">
            2
          </div>
          <div className="bg-amber-50/40 rounded-lg p-3 border border-amber-200 text-xs">
            <div className="font-semibold text-amber-900">Controlled Fault Injected</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {experiment.manifest.fault_sequence.map((f, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[11px]">
                  {f.fault_type} ({f.severity})
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Step 3: Intent Perturbation Evaluation */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-100 border-2 border-rose-600 flex items-center justify-center text-[10px] font-bold text-rose-700">
            3
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
            <div className="font-semibold text-slate-900">Safety Gate Evaluation Under Fault</div>
            <p className="text-slate-600 mt-1">
              Candidate intent processed through perturbed pipeline. Authorization during failure:{" "}
              <strong className={experiment.authorization_during_failure ? "text-rose-600 font-bold" : "text-emerald-700 font-semibold"}>
                {String(experiment.authorization_during_failure)}
              </strong>{" "}
              {experiment.authorization_during_failure ? "(Accidental Clearance!)" : "(Fail-Closed Blocked)"}
            </p>
          </div>
        </div>

        {/* Step 4: Invariant Verification */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-purple-100 border-2 border-purple-600 flex items-center justify-center text-[10px] font-bold text-purple-700">
            4
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
            <div className="font-semibold text-slate-900">Platform Invariant Verification</div>
            <p className="text-slate-600 mt-1">
              Formal inspection of 14 system invariants. Result:{" "}
              <span className="font-semibold text-teal-700">
                {experiment.invariants.filter((inv) => inv.status === "PASS").length}/
                {experiment.invariants.length} Passed
              </span>
            </p>
          </div>
        </div>

        {/* Step 5: Safe Recovery Certification */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-teal-100 border-2 border-teal-600 flex items-center justify-center text-[10px] font-bold text-teal-700">
            5
          </div>
          <div className="bg-teal-50/40 rounded-lg p-3 border border-teal-200 text-xs">
            <div className="font-semibold text-teal-900">Conservative Recovery Certification</div>
            <p className="text-slate-600 mt-1">
              Status: <strong className="text-teal-800">{experiment.recovery_status}</strong>. Data Loss:{" "}
              <span className="font-mono text-slate-700">{experiment.data_loss_status}</span>. Authorization after
              recovery:{" "}
              <strong className={experiment.authorization_after_failure ? "text-rose-600" : "text-slate-700"}>
                {String(experiment.authorization_after_failure)}
              </strong>{" "}
              (Fresh evaluation required).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
