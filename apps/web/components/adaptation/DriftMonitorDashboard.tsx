"use client";

import React, { useState } from "react";
import { DriftObservation, DriftStatus } from "@neuromove/contracts";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Info } from "lucide-react";

interface DriftMonitorDashboardProps {
  driftData: DriftObservation | null;
  onRefreshDrift: (injectShift: boolean) => Promise<void>;
  isRefreshing: boolean;
  isResearchMode?: boolean;
}

export const DriftMonitorDashboard: React.FC<DriftMonitorDashboardProps> = ({
  driftData,
  onRefreshDrift,
  isRefreshing,
}) => {

  const [injectShift, setInjectShift] = useState(false);

  const getStatusBadge = (status: DriftStatus) => {
    switch (status) {
      case "STABLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Stable (No Shift)
          </span>
        );
      case "MONITOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Monitor (Marginal Shift)
          </span>
        );
      case "SHIFT_DETECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Distribution Shift Detected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Insufficient Data
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600" />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Electrophysiological Distribution Drift Monitor
            </h3>
            <p className="text-xs text-slate-500">
              Statistical research diagnostics (Wasserstein distance & label shifts)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={injectShift}
              onChange={(e) => setInjectShift(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>Simulate Shift Dynamics</span>
          </label>
          <button
            onClick={() => onRefreshDrift(injectShift)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Diagnostics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-teal-600" : ""}`} />
          </button>
        </div>
      </div>

      {driftData ? (
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-medium text-slate-700">
              Current Research Diagnostic Status:
            </span>
            {getStatusBadge(driftData.status)}
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] font-medium block">
                Feature Distribution Shift (Wasserstein)
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {driftData.feature_shift_score.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Threshold: {driftData.thresholds.feature_shift_threshold}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] font-medium block">
                Class Proportion Shift (TV Distance)
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {(driftData.class_distribution_shift * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 block">
                Threshold: {(driftData.thresholds.class_shift_threshold * 100).toFixed(0)}%
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] font-medium block">
                Electrode Signal Quality Index
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {(driftData.signal_quality_score * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-emerald-600 block font-medium">
                High SNR / Low Artifact
              </span>
            </div>
          </div>

          {/* Research Disclaimer */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Scientific & Non-Clinical Disclaimer:</strong> Distribution shift metrics reflect
              recording variances, electrode impedance changes, or sensory habituation. They are monitored
              strictly as research diagnostics and do NOT trigger autonomous model adaptation or indicate clinical decline.
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-slate-500">
          Click refresh above to run real-time electrophysiological distribution drift analysis.
        </div>
      )}
    </div>
  );
};
