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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Deterministic Sensor Fusion Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Synthesizes auxiliary sensor evidence without direct actuation, modulating BCI confidence and gating contradictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs font-mono px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
            Strategy: {strategy}
          </span>
          {hasContradiction ? (
            <span className="flex items-center gap-1 text-2xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> CONTRADICTION: {outcome}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> FUSION NOMINAL
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Modulated Confidence</div>
          <div className="text-2xl font-bold font-mono text-teal-700 mt-1">
            {(contextConfidence * 100).toFixed(1)}%
          </div>
          <div className="text-2xs text-slate-500 mt-1">Gated by auxiliary context</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Fused Context Score</div>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
            {fusedScore.toFixed(3)}
          </div>
          <div className="text-2xs text-slate-500 mt-1">Cross-modality agreement</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Participating Sensors</div>
          <div className="text-sm font-bold font-mono text-slate-800 mt-1">
            {fusionResult?.participating_sensor_ids?.length ?? 2} sensors
          </div>
          <div className="text-2xs text-slate-500 mt-1">
            {fusionResult?.participating_modalities?.join(", ") ?? "EEG, IMU"}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-3xs font-mono font-bold text-slate-500 uppercase">Contradiction State</div>
          <div className={`text-sm font-bold font-mono mt-1 ${hasContradiction ? "text-rose-700" : "text-emerald-700"}`}>
            {hasContradiction ? outcome : "NONE"}
          </div>
          <div className="text-2xs text-slate-500 mt-1">
            {hasContradiction ? "Safety hold active" : "Safe to evaluate"}
          </div>
        </div>
      </div>

      {/* Contradiction Alert Box */}
      {hasContradiction && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Safety Interlock: Multimodal Contradiction Detected ({outcome})
          </div>
          <p className="text-xs text-rose-700 font-mono">
            {reason || "Auxiliary sensor evidence conflicts with candidate intent or EEG signal integrity."}
          </p>
        </div>
      )}

      {/* Evidence Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
          Synthesized Fusion Evidence
        </h3>
        {evidenceList.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-3 text-center border border-slate-200 rounded-lg bg-slate-50">
            No auxiliary evidence records in current frame.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 text-2xs uppercase">
                  <th className="p-2.5">Sensor</th>
                  <th className="p-2.5">Modality</th>
                  <th className="p-2.5">Feature</th>
                  <th className="p-2.5">Value</th>
                  <th className="p-2.5">Confidence</th>
                  <th className="p-2.5">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidenceList.map((ev) => (
                  <tr key={ev.evidence_id} className="hover:bg-slate-50/70">
                    <td className="p-2.5 text-slate-900 font-bold">{ev.sensor_id}</td>
                    <td className="p-2.5 text-teal-700 font-semibold">{ev.modality}</td>
                    <td className="p-2.5 text-slate-600">{ev.feature_name}</td>
                    <td className="p-2.5 text-slate-900 font-mono">{ev.feature_value.toFixed(4)}</td>
                    <td className="p-2.5 text-emerald-700 font-bold">{(ev.confidence * 100).toFixed(0)}%</td>
                    <td className="p-2.5 text-slate-500 italic">{ev.interpretation}</td>
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
