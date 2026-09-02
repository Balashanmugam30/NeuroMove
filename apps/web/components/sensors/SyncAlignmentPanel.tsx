"use client";

import React from "react";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import type { MultimodalSyncState } from "@neuromove/contracts";

interface SyncAlignmentPanelProps {
  syncState: MultimodalSyncState | null;
}

export const SyncAlignmentPanel: React.FC<SyncAlignmentPanelProps> = ({ syncState }) => {
  const status = syncState?.status ?? "SYNCHRONIZED";
  const alignmentPct = syncState?.alignment_quality_pct ?? 100.0;
  const primarySensor = syncState?.primary_clock_sensor_id ?? "sensor_eeg_sim";
  const offsets = syncState?.estimated_offsets_ms ?? { sensor_eeg_sim: 0.0, sensor_imu_sim: 2.1 };
  const drifts = syncState?.estimated_drifts_ppm ?? { sensor_eeg_sim: 0.0, sensor_imu_sim: 12.4 };

  const getStatusBadge = () => {
    switch (status) {
      case "SYNCHRONIZED":
        return (
          <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> SYNCHRONIZED
          </span>
        );
      case "DRIFT_DETECTED":
        return (
          <span className="flex items-center gap-1 text-2xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> DRIFT DETECTED
          </span>
        );
      case "DEGRADED":
        return (
          <span className="flex items-center gap-1 text-2xs font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> DEGRADED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-2xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> UNSYNCHRONIZED
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Multi-Clock Synchronization & Drift</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Common temporal reference domain tracking inter-sensor latency, jitter, and clock drift in parts-per-million.
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Alignment Quality</div>
          <div className="text-xl font-bold font-mono text-teal-700 mt-1">
            {alignmentPct.toFixed(1)}%
          </div>
          <div className="text-2xs text-slate-500 mt-1">Phase alignment</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Max Jitter</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {syncState?.max_jitter_ms?.toFixed(2) ?? "0.45"} ms
          </div>
          <div className="text-2xs text-slate-500 mt-1">Host RX variation</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Primary Clock</div>
          <div className="text-sm font-bold font-mono text-emerald-700 mt-1 truncate">
            {primarySensor}
          </div>
          <div className="text-2xs text-slate-500 mt-1">Reference master</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Discontinuities</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {syncState?.total_discontinuities ?? 0}
          </div>
          <div className="text-2xs text-slate-500 mt-1">Backwards jumps</div>
        </div>
      </div>

      {/* Per-Sensor Alignment Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
          Sensor Clock Drift & Offset Table
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 text-2xs uppercase">
                <th className="p-2.5">Sensor Identifier</th>
                <th className="p-2.5">Offset vs Reference</th>
                <th className="p-2.5">Estimated Drift</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(offsets).map(([sId, offset]) => {
                const drift = drifts[sId] ?? 0.0;
                const isPrimary = sId === primarySensor;
                const isWarning = Math.abs(offset) > 30.0 || Math.abs(drift) > 50.0;

                return (
                  <tr key={sId} className="hover:bg-slate-50/70">
                    <td className="p-2.5 font-semibold text-slate-800">
                      {sId} {isPrimary && <span className="text-teal-700 font-bold">(Master)</span>}
                    </td>
                    <td className="p-2.5">
                      <span className={Math.abs(offset) > 30 ? "text-amber-700 font-bold" : "text-slate-700"}>
                        {offset > 0 ? `+${offset.toFixed(2)}` : offset.toFixed(2)} ms
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={Math.abs(drift) > 50 ? "text-amber-700 font-bold" : "text-slate-700"}>
                        {drift.toFixed(1)} ppm
                      </span>
                    </td>
                    <td className="p-2.5">
                      {isWarning ? (
                        <span className="text-amber-700 font-bold flex items-center gap-1 text-2xs">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Drift Warning
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-2xs">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Nominal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
