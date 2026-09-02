"use client";

import React, { useState } from "react";
import { Play, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { FaultExperiment } from "@neuromove/contracts";

interface ReplayComparisonPanelProps {
  experiments: FaultExperiment[];
  onReplay: (experimentId: string) => Promise<{
    experiment_id: string;
    deterministic_parity: boolean;
    manifest_checksum: string;
    original_status: string;
  }>;
  isReplaying?: boolean;
}

export function ReplayComparisonPanel({
  experiments,
  onReplay,
  isReplaying = false,
}: ReplayComparisonPanelProps) {
  const [selectedExpId, setSelectedExpId] = useState<string>(experiments[0]?.experiment_id || "");
  const [replayResult, setReplayResult] = useState<{
    experiment_id: string;
    deterministic_parity: boolean;
    manifest_checksum: string;
    original_status: string;
  } | null>(null);

  const handleReplayClick = async () => {
    if (!selectedExpId) return;
    try {
      const res = await onReplay(selectedExpId);
      setReplayResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Deterministic Replay Engine</h3>
            <p className="text-xs text-slate-500">
              Cryptographically verify that experiment manifests replay to identical outcomes
            </p>
          </div>
        </div>

        <button
          onClick={handleReplayClick}
          disabled={isReplaying || !selectedExpId}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isReplaying ? "Replaying Manifest..." : "Replay Experiment"}
        </button>
      </div>

      <div className="my-4">
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Select Historical Experiment Manifest:
        </label>
        <select
          value={selectedExpId}
          onChange={(e) => setSelectedExpId(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:ring-1 focus:ring-indigo-500 font-mono"
        >
          {experiments.map((exp) => (
            <option key={exp.experiment_id} value={exp.experiment_id}>
              {exp.experiment_id} — {exp.name} (Status: {exp.status}, Checksum: {exp.manifest?.manifest_checksum || "N/A"})
            </option>
          ))}
          {experiments.length === 0 && (
            <option value="">No historical experiments available</option>
          )}
        </select>
      </div>

      {replayResult && (
        <div className="p-4 rounded-lg border bg-slate-50 border-slate-200 mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {replayResult.deterministic_parity ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="text-xs font-bold text-slate-900">
                Deterministic Parity Verdict:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  replayResult.deterministic_parity
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                {replayResult.deterministic_parity ? "100% PARITY MATCHED" : "PARITY MISMATCH"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
            <div>
              <span className="text-slate-500">Experiment ID:</span>
              <div className="font-mono text-slate-800 font-semibold">{replayResult.experiment_id}</div>
            </div>
            <div>
              <span className="text-slate-500">Manifest SHA-256 Checksum:</span>
              <div className="font-mono text-indigo-700 font-semibold">{replayResult.manifest_checksum}</div>
            </div>
            <div>
              <span className="text-slate-500">Original Status:</span>
              <div className="font-semibold text-slate-800">{replayResult.original_status}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
