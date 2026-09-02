"use client";

import React, { useState } from "react";
import { AblationRun, ResearchExperiment } from "@neuromove/contracts";
import { GitFork, Play } from "lucide-react";

interface AblationSweepWorkspaceProps {
  experiment?: ResearchExperiment;
  onRunAblation: (ablationType: string, delta: Record<string, any>) => Promise<void>;
  isAblating?: boolean;
  ablationHistory?: AblationRun[];
}

export function AblationSweepWorkspace({
  experiment: _experiment,
  onRunAblation,
  isAblating = false,
  ablationHistory = [],
}: AblationSweepWorkspaceProps) {
  const [selectedType, setSelectedType] = useState<string>("CHANNEL_DROPOUT");
  const [channelSet, setChannelSet] = useState<string>("C3,Cz,C4");
  const [bandpassRange, setBandpassRange] = useState<string>("10-20");

  const handleLaunch = async () => {
    let delta: Record<string, any> = {};
    if (selectedType === "CHANNEL_DROPOUT") {
      delta = { channel_names: channelSet.split(",").map((c) => c.trim()) };
    } else if (selectedType === "BANDPASS_FILTER") {
      const [low, high] = bandpassRange.split("-").map(Number);
      delta = { dsp_config: { lowcut: low, highcut: high, order: 2 } };
    } else if (selectedType === "CONFIDENCE_THRESHOLD") {
      delta = { confidence_policy: { threshold: 0.90 } };
    } else if (selectedType === "PERSONALIZATION_TOGGLE") {
      delta = { personalization_profile: { enabled: false } };
    }
    await onRunAblation(selectedType, delta);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-100">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Controlled Ablation Studies
            </h3>
            <p className="text-xs text-slate-500">
              Isolate algorithmic components by spawning immutable child experiments with parameter deltas
            </p>
          </div>
        </div>
      </div>

      {/* Ablation Form Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <label className="block text-3xs uppercase font-bold text-slate-500 font-mono mb-1">
            Ablation Target
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-purple-500 font-sans"
          >
            <option value="CHANNEL_DROPOUT">Channel Montage Reduction</option>
            <option value="BANDPASS_FILTER">DSP Filter Bandpass Shift</option>
            <option value="CONFIDENCE_THRESHOLD">Strict Confidence (0.90)</option>
            <option value="PERSONALIZATION_TOGGLE">Disable Personalization</option>
          </select>
        </div>

        <div>
          {selectedType === "CHANNEL_DROPOUT" && (
            <div>
              <label className="block text-3xs uppercase font-bold text-slate-500 font-mono mb-1">
                Subset Channels
              </label>
              <input
                type="text"
                value={channelSet}
                onChange={(e) => setChannelSet(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                placeholder="C3,Cz,C4"
              />
            </div>
          )}
          {selectedType === "BANDPASS_FILTER" && (
            <div>
              <label className="block text-3xs uppercase font-bold text-slate-500 font-mono mb-1">
                Bandpass Range (Hz)
              </label>
              <input
                type="text"
                value={bandpassRange}
                onChange={(e) => setBandpassRange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                placeholder="10-20"
              />
            </div>
          )}
          {(selectedType === "CONFIDENCE_THRESHOLD" || selectedType === "PERSONALIZATION_TOGGLE") && (
            <div>
              <label className="block text-3xs uppercase font-bold text-slate-500 font-mono mb-1">
                Preset Parameter
              </label>
              <div className="text-xs font-mono text-purple-700 py-1.5 font-semibold">
                {selectedType === "CONFIDENCE_THRESHOLD" ? "threshold = 0.90" : "personalization = OFF"}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isAblating}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isAblating ? "Executing Ablation..." : "Run Ablation Experiment"}
          </button>
        </div>
      </div>

      {/* History of Ablation Experiments */}
      {ablationHistory.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
            Ablation Lineage & Impact Records
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-3xs uppercase">
                  <th className="py-2 px-3">Child ID</th>
                  <th className="py-2 px-2">Ablation Type</th>
                  <th className="py-2 px-2 text-right">Baseline Acc</th>
                  <th className="py-2 px-2 text-right">Ablated Acc</th>
                  <th className="py-2 px-2 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ablationHistory.map((rec) => {
                  const isNegative = rec.accuracy_delta < 0;
                  return (
                    <tr key={rec.ablation_id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-blue-700 truncate max-w-[120px] font-semibold" title={rec.child_experiment_id}>
                        {rec.child_experiment_id}
                      </td>
                      <td className="py-2 px-2 text-slate-800 font-sans">{rec.ablation_type}</td>
                      <td className="py-2 px-2 text-right text-slate-500">
                        {(rec.baseline_accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right text-slate-900 font-bold">
                        {(rec.ablated_accuracy * 100).toFixed(1)}%
                      </td>
                      <td className={`py-2 px-2 text-right font-bold ${isNegative ? "text-rose-700" : "text-emerald-700"}`}>
                        {rec.accuracy_delta > 0 ? "+" : ""}{(rec.accuracy_delta * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
