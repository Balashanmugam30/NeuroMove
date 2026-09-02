"use client";

import React from "react";
import { ShieldCheck, Cpu, Radio, GitMerge, Brain, Waves, ShieldAlert } from "lucide-react";

interface MultimodalPipelineFlowProps {
  inferenceResult?: Record<string, any> | null;
}

export const MultimodalPipelineFlow: React.FC<MultimodalPipelineFlowProps> = ({ inferenceResult }) => {
  const hilDispatched = inferenceResult?.hil_dispatched ?? true;
  const syncStatus = inferenceResult?.sync_status ?? "SYNCHRONIZED";
  const motionState = inferenceResult?.motion_state ?? "STATIONARY";
  const confidence = inferenceResult?.final_confidence ?? 0.90;
  const verdict = inferenceResult?.safety_verdict ?? "AUTHORIZED";

  const stages = [
    {
      name: "1. Sensor Streams",
      icon: Waves,
      status: "ACTIVE",
      subtext: "EEG + Auxiliary Streams",
      color: "text-cyan-400 border-cyan-500/40 bg-cyan-950/20",
    },
    {
      name: "2. Sync & Clock",
      icon: Radio,
      status: syncStatus,
      subtext: syncStatus === "SYNCHRONIZED" ? "< 30ms offset" : "Drift detected",
      color: syncStatus === "SYNCHRONIZED" ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" : "text-amber-400 border-amber-500/40 bg-amber-950/20",
    },
    {
      name: "3. QC Engine",
      icon: ShieldCheck,
      status: "VALID",
      subtext: "SNR & Dropout check",
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/20",
    },
    {
      name: "4. Sensor Fusion",
      icon: GitMerge,
      status: inferenceResult?.has_contradiction ? "CONTRADICTION" : "NOMINAL",
      subtext: `Conf: ${(confidence * 100).toFixed(0)}%`,
      color: inferenceResult?.has_contradiction ? "text-rose-400 border-rose-500/40 bg-rose-950/20" : "text-indigo-400 border-indigo-500/40 bg-indigo-950/20",
    },
    {
      name: "5. Context Engine",
      icon: Brain,
      status: motionState,
      subtext: motionState === "STATIONARY" ? "Quiet / Valid" : "Active movement",
      color: motionState === "STATIONARY" ? "text-purple-400 border-purple-500/40 bg-purple-950/20" : "text-amber-400 border-amber-500/40 bg-amber-950/20",
    },
    {
      name: "6. Safety (Phase 17)",
      icon: ShieldAlert,
      status: verdict,
      subtext: verdict === "AUTHORIZED" ? "Safety cleared" : "Safety interlock hold",
      color: verdict === "AUTHORIZED" ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" : "text-rose-400 border-rose-500/40 bg-rose-950/20",
    },
    {
      name: "7. HIL (Phase 20)",
      icon: Cpu,
      status: hilDispatched ? "DISPATCHED" : "HELD",
      subtext: "ESP32 Virtual Emulator",
      color: hilDispatched ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" : "text-slate-400 border-slate-700 bg-slate-900/40",
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-semibold text-slate-100">Canonical Multimodal Pipeline Architecture</h2>
        <p className="text-xs text-slate-400 mt-1">
          Strict unidirectional evidence hierarchy: Auxiliary sensors provide context only and never directly actuate hardware.
        </p>
      </div>

      {/* Interactive Pipeline Flow Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {stages.map((stg) => {
          const Icon = stg.icon;
          return (
            <div
              key={stg.name}
              className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 ${stg.color}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900/80">
                  {stg.status}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">{stg.name}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">{stg.subtext}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
