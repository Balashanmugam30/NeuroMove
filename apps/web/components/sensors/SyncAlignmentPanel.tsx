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
          <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> SYNCHRONIZED
          </span>
        );
      case "DRIFT_DETECTED":
        return (
          <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> DRIFT DETECTED
          </span>
        );
      case "DEGRADED":
        return (
          <span className="flex items-center gap-1 text-xs font-mono text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> DEGRADED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> UNSYNCHRONIZED
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">Multi-Clock Synchronization & Drift</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Common temporal reference domain tracking inter-sensor latency, jitter, and clock drift in parts-per-million.
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Alignment Quality</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {alignmentPct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Phase alignment</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Max Jitter</div>
          <div className="text-xl font-bold font-mono text-slate-200 mt-1">
            {syncState?.max_jitter_ms?.toFixed(2) ?? "0.45"} ms
          </div>
          <div className="text-xs text-slate-400 mt-1">Host RX variation</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Primary Clock</div>
          <div className="text-sm font-bold font-mono text-emerald-400 mt-1 truncate">
            {primarySensor}
          </div>
          <div className="text-xs text-slate-400 mt-1">Reference master</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Discontinuities</div>
          <div className="text-xl font-bold font-mono text-slate-200 mt-1">
            {syncState?.total_discontinuities ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Backwards jumps</div>
        </div>
      </div>

      {/* Per-Sensor Alignment Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Sensor Clock Drift & Offset Table
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 bg-slate-950/40">
                <th className="p-2.5">Sensor Identifier</th>
                <th className="p-2.5">Offset vs Reference</th>
                <th className="p-2.5">Estimated Drift</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {Object.entries(offsets).map(([sId, offset]) => {
                const drift = drifts[sId] ?? 0.0;
                const isPrimary = sId === primarySensor;
                const isWarning = Math.abs(offset) > 30.0 || Math.abs(drift) > 50.0;

                return (
                  <tr key={sId} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-medium text-slate-300">
                      {sId} {isPrimary && <span className="text-cyan-400 font-semibold">(Master)</span>}
                    </td>
                    <td className="p-2.5">
                      <span className={Math.abs(offset) > 30 ? "text-amber-400" : "text-slate-300"}>
                        {offset > 0 ? `+${offset.toFixed(2)}` : offset.toFixed(2)} ms
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={Math.abs(drift) > 50 ? "text-amber-400" : "text-slate-300"}>
                        {drift.toFixed(1)} ppm
                      </span>
                    </td>
                    <td className="p-2.5">
                      {isWarning ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Drift Warning
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Nominal
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
