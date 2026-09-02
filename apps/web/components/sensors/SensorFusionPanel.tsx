"use client";

import React from "react";
import { GitMerge, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import type { FusionResult } from "@neuromove/contracts";

interface SensorFusionPanelProps {
  fusionResult: FusionResult | null;
}

export const SensorFusionPanel: React.FC<SensorFusionPanelProps> = ({ fusionResult }) => {
  const hasContradiction = fusionResult?.has_contradiction ?? false;
  const strategy = fusionResult?.strategy ?? "RULE_BASED_CONTEXT";
  const contextConfidence = fusionResult?.context_confidence ?? 0.90;
  const fusedScore = fusionResult?.fused_context_score ?? 0.88;
  const evidenceList = fusionResult?.evidence ?? [];
  const outcome = fusionResult?.contradiction_outcome ?? "NOMINAL";
  const reason = fusionResult?.contradiction_reason;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100">Deterministic Sensor Fusion Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Synthesizes auxiliary sensor evidence without direct actuation, modulating BCI confidence and gating contradictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-indigo-300 border border-indigo-500/20">
            Strategy: {strategy}
          </span>
          {hasContradiction ? (
            <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
              <ShieldAlert className="w-3.5 h-3.5" /> CONTRADICTION: {outcome}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> FUSION NOMINAL
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Modulated Confidence</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {(contextConfidence * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Gated by auxiliary context</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Fused Context Score</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {fusedScore.toFixed(3)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Cross-modality agreement</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Participating Sensors</div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1">
            {fusionResult?.participating_sensor_ids?.length ?? 2} sensors
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {fusionResult?.participating_modalities?.join(", ") ?? "EEG, IMU"}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="text-xs font-mono text-slate-500">Contradiction State</div>
          <div className={`text-sm font-bold font-mono mt-1 ${hasContradiction ? "text-rose-400" : "text-emerald-400"}`}>
            {hasContradiction ? outcome : "NONE"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {hasContradiction ? "Safety hold active" : "Safe to evaluate"}
          </div>
        </div>
      </div>

      {/* Contradiction Alert Box */}
      {hasContradiction && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-lg p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Safety Interlock: Multimodal Contradiction Detected ({outcome})
          </div>
          <p className="text-xs text-rose-200/90 font-mono">
            {reason || "Auxiliary sensor evidence conflicts with candidate intent or EEG signal integrity."}
          </p>
        </div>
      )}

      {/* Evidence Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Synthesized Fusion Evidence
        </h3>
        {evidenceList.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-3 text-center border border-slate-800 rounded bg-slate-950/40">
            No auxiliary evidence records in current frame.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 bg-slate-950/40">
                  <th className="p-2.5">Sensor</th>
                  <th className="p-2.5">Modality</th>
                  <th className="p-2.5">Feature</th>
                  <th className="p-2.5">Value</th>
                  <th className="p-2.5">Confidence</th>
                  <th className="p-2.5">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {evidenceList.map((ev) => (
                  <tr key={ev.evidence_id} className="hover:bg-slate-800/30">
                    <td className="p-2.5 text-slate-300 font-medium">{ev.sensor_id}</td>
                    <td className="p-2.5 text-cyan-400">{ev.modality}</td>
                    <td className="p-2.5 text-slate-400">{ev.feature_name}</td>
                    <td className="p-2.5 text-slate-200">{ev.feature_value.toFixed(4)}</td>
                    <td className="p-2.5 text-emerald-400">{(ev.confidence * 100).toFixed(0)}%</td>
                    <td className="p-2.5 text-slate-400 italic">{ev.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
