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
      color: "text-teal-700 border-teal-200 bg-teal-50",
    },
    {
      name: "2. Sync & Clock",
      icon: Radio,
      status: syncStatus,
      subtext: syncStatus === "SYNCHRONIZED" ? "< 30ms offset" : "Drift detected",
      color: syncStatus === "SYNCHRONIZED" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-amber-700 border-amber-200 bg-amber-50",
    },
    {
      name: "3. QC Engine",
      icon: ShieldCheck,
      status: "VALID",
      subtext: "SNR & Dropout check",
      color: "text-emerald-700 border-emerald-200 bg-emerald-50",
    },
    {
      name: "4. Sensor Fusion",
      icon: GitMerge,
      status: inferenceResult?.has_contradiction ? "CONTRADICTION" : "NOMINAL",
      subtext: `Conf: ${(confidence * 100).toFixed(0)}%`,
      color: inferenceResult?.has_contradiction ? "text-rose-700 border-rose-200 bg-rose-50" : "text-blue-700 border-blue-200 bg-blue-50",
    },
    {
      name: "5. Context Engine",
      icon: Brain,
      status: motionState,
      subtext: motionState === "STATIONARY" ? "Quiet / Valid" : "Active movement",
      color: motionState === "STATIONARY" ? "text-purple-700 border-purple-200 bg-purple-50" : "text-amber-700 border-amber-200 bg-amber-50",
    },
    {
      name: "6. Safety (Phase 17)",
      icon: ShieldAlert,
      status: verdict,
      subtext: verdict === "AUTHORIZED" ? "Safety cleared" : "Safety interlock hold",
      color: verdict === "AUTHORIZED" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-rose-700 border-rose-200 bg-rose-50",
    },
    {
      name: "7. HIL (Phase 20)",
      icon: Cpu,
      status: hilDispatched ? "DISPATCHED" : "HELD",
      subtext: "ESP32 Virtual Emulator",
      color: hilDispatched ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-600 border-slate-200 bg-slate-50",
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900">Canonical Multimodal Pipeline Architecture</h2>
        <p className="text-xs text-slate-500 mt-1">
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
              className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 shadow-2xs ${stg.color}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4" />
                <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 shadow-2xs">
                  {stg.status}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{stg.name}</div>
                <div className="text-3xs font-mono text-slate-500 mt-0.5">{stg.subtext}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
