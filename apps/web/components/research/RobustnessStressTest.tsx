"use client";

import React, { useState } from "react";
import { RobustnessRun } from "@neuromove/contracts";
import { ShieldAlert, Play, TrendingDown } from "lucide-react";

interface RobustnessStressTestProps {
  onRunSweep: (perturbationType: string, levels: number[]) => Promise<void>;
  isSweeping?: boolean;
  sweepResults?: RobustnessRun[];
}

export function RobustnessStressTest({
  onRunSweep,
  isSweeping = false,
  sweepResults = [],
}: RobustnessStressTestProps) {
  const [perturbationType, setPerturbationType] = useState<string>("ADDITIVE_NOISE");

  const handleLaunch = async () => {
    await onRunSweep(perturbationType, [0.1, 0.25, 0.5, 0.75, 1.0]);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Systematic Robustness & Perturbation Sweeps
            </h3>
            <p className="text-xs text-slate-500">
              Evaluate degradation profiles under simulated noise, channel dropouts, packet drops, and clipping
            </p>
          </div>
        </div>
      </div>

      {/* Sweep Launcher Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-3xs uppercase font-bold text-slate-500 font-mono mb-1">
            Perturbation Mechanism
          </label>
          <select
            value={perturbationType}
            onChange={(e) => setPerturbationType(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-rose-500 font-sans"
          >
            <option value="ADDITIVE_NOISE">Gaussian Additive Noise (0.1–1.0x)</option>
            <option value="AMPLITUDE_SCALING">Amplitude Gain Scaling (1.1–2.0x)</option>
            <option value="CHANNEL_DROPOUT">Channel Dropout Sweep (10–100%)</option>
            <option value="PACKET_LOSS">Packet & Sample Loss (10–100%)</option>
            <option value="AMPLITUDE_CLIPPING">Amplitude Saturation / Clipping</option>
            <option value="VARIANCE_PERTURBATION">Inter-Channel Variance Noise</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isSweeping}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isSweeping ? "Sweeping Levels..." : "Launch Perturbation Sweep"}
          </button>
        </div>
      </div>

      {/* Sweep Results Table */}
      {sweepResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              Degradation Profile
            </h4>
            <span className="text-3xs font-mono text-slate-500">
              5 Perturbation Levels Audited
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-3xs uppercase">
                  <th className="py-2 px-3">Severity Level</th>
                  <th className="py-2 px-2 text-right">Accuracy</th>
                  <th className="py-2 px-2 text-right">Macro F1</th>
                  <th className="py-2 px-2 text-right">QC Degraded</th>
                  <th className="py-2 px-2 text-right">Rejection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sweepResults.map((run) => (
                  <tr key={run.robustness_id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-semibold text-rose-700">
                      Level {(run.perturbation_level * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-right text-slate-900 font-bold">
                      {(run.resulting_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right text-blue-700 font-semibold">
                      {run.resulting_f1.toFixed(3)}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-700 font-semibold">
                      {(run.qc_degraded_rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500">
                      {(run.rejection_rate * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
