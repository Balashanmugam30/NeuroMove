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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Systematic Robustness & Perturbation Sweeps
            </h3>
            <p className="text-xs text-slate-400">
              Evaluate degradation profiles under simulated noise, channel dropouts, packet drops, and clipping
            </p>
          </div>
        </div>
      </div>

      {/* Sweep Launcher Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-4 rounded-lg border border-slate-800">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-3xs uppercase font-bold text-slate-400 mb-1">
            Perturbation Mechanism
          </label>
          <select
            value={perturbationType}
            onChange={(e) => setPerturbationType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-rose-500 font-sans"
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
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              Degradation Profile
            </h4>
            <span className="text-3xs font-mono text-slate-400">
              5 Perturbation Levels Audited
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-3xs uppercase">
                  <th className="py-2 px-3">Severity Level</th>
                  <th className="py-2 px-2 text-right">Accuracy</th>
                  <th className="py-2 px-2 text-right">Macro F1</th>
                  <th className="py-2 px-2 text-right">QC Degraded</th>
                  <th className="py-2 px-2 text-right">Rejection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sweepResults.map((run) => (
                  <tr key={run.robustness_id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-semibold text-rose-300">
                      Level {(run.perturbation_level * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-right text-white font-bold">
                      {(run.resulting_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right text-indigo-300">
                      {run.resulting_f1.toFixed(3)}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-400">
                      {(run.qc_degraded_rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-right text-slate-400">
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
