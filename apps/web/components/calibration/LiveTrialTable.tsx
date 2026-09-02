"use client";

import React from "react";
import { CalibrationTrial } from "@neuromove/contracts";
import { CheckCircle2, AlertTriangle, XCircle, Tag } from "lucide-react";


interface LiveTrialTableProps {
  trials: CalibrationTrial[];
  activeTrialIndex?: number;
}

export function LiveTrialTable({ trials, activeTrialIndex }: LiveTrialTableProps) {
  if (trials.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
        No trials generated yet. Arm a calibration protocol to view scheduled trials.
      </div>
    );
  }

  const getQCBadge = (status: string, reasons: string[]) => {
    if (status === "PASS") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> PASS
        </span>
      );
    }
    if (status === "WARN") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> WARN
        </span>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold bg-rose-50 text-rose-700 border border-rose-200 w-fit">
          <XCircle className="w-3 h-3" /> REJECT
        </span>
        {reasons.map((r) => (
          <span key={r} className="text-3xs font-mono text-rose-600">
            {r}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Calibration Trial Audit Table</h3>
          <p className="text-xs text-slate-500">Sequence order, requested imagery classes, and research QC statuses</p>
        </div>
        <span className="text-xs font-mono text-slate-500 font-semibold">
          {trials.filter((t) => t.status === "COMPLETED").length} / {trials.length} Recorded
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-3xs uppercase tracking-wider">
              <th className="py-2.5 px-4 w-16">#</th>
              <th className="py-2.5 px-4">Requested Imagery Class</th>
              <th className="py-2.5 px-4">Planned Onset</th>
              <th className="py-2.5 px-4">Actual Timing</th>
              <th className="py-2.5 px-4">Trial Status</th>
              <th className="py-2.5 px-4">Research QC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {trials.map((trial, idx) => {
              const isActive = activeTrialIndex === idx;
              const isLeft = trial.target_label === "LEFT_IMAGERY";

              return (
                <tr
                  key={trial.trial_id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isActive ? "bg-blue-50/50 font-semibold" : ""
                  }`}
                >
                  <td className="py-2.5 px-4 text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-sans font-medium">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        isLeft
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-teal-50 text-teal-800 border border-teal-200"
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {isLeft ? "Left Hand Imagery" : "Right Hand Imagery"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{trial.planned_onset.toFixed(2)}s</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {trial.actual_onset !== null ? `${trial.actual_onset.toFixed(2)}s` : "—"}
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-3xs font-semibold uppercase ${
                        trial.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700"
                          : trial.status === "ACTIVE"
                          ? "bg-blue-100 text-blue-800 animate-pulse"
                          : trial.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700"
                          : trial.status === "ABORTED"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {trial.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    {trial.status === "COMPLETED" || trial.status === "REJECTED" ? (
                      getQCBadge(trial.quality_status, trial.quality_reasons)
                    ) : (
                      <span className="text-slate-400 text-3xs font-mono">PENDING</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
