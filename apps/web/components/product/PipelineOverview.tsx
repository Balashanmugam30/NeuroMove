"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  category: string;
  description: string;
  route_href: string;
  status: "HEALTHY" | "ACTIVE" | "DEGRADED" | "BLOCKED";
  metrics: Record<string, string | number>;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "sensors",
    name: "1. Sensors & Context",
    category: "Acquisition",
    description: "Multimodal sensor discovery, clock normalization, inter-sensor synchronization, and QC.",
    route_href: "/sensors",
    status: "HEALTHY",
    metrics: { "Active Sensors": "EEG + IMU", "Offset": "< 2.5ms", "Drift": "4.2 ppm" },
  },
  {
    id: "signal",
    name: "2. Signal DSP",
    category: "Signal Processing",
    description: "Real-time 8-30 Hz bandpass filtering, notch filter, and temporal epoch segmentation.",
    route_href: "/eeg/preprocessing",
    status: "HEALTHY",
    metrics: { "Sampling Rate": "250 Hz", "Epoch Length": "1.0s", "SNR": "24.5 dB" },
  },
  {
    id: "decoding",
    name: "3. Feature Decoding",
    category: "AI / Machine Learning",
    description: "Common Spatial Patterns (CSP) filtering and LDA motor-imagery intent classification.",
    route_href: "/models/lab",
    status: "HEALTHY",
    metrics: { "Model": "CSP + LDA", "Components": 4, "Validation Acc": "88.4%" },
  },
  {
    id: "confidence",
    name: "4. Confidence Engine",
    category: "Validation",
    description: "Temporal evidence window accumulation, hysteresis thresholding, and SNR gating.",
    route_href: "/confidence",
    status: "HEALTHY",
    metrics: { "Score": 0.92, "Threshold": 0.70, "Epochs Required": 4 },
  },
  {
    id: "intent",
    name: "5. Intent Lifecycle",
    category: "Control",
    description: "Finite state machine managing Candidate -> Confirmed -> Activated intent transitions.",
    route_href: "/intent",
    status: "HEALTHY",
    metrics: { "Lifecycle": "ACTIVATED", "Intent": "FORWARD", "Freshness": "< 50ms" },
  },
  {
    id: "safety",
    name: "6. Safety Arbitration",
    category: "Protection",
    description: "Deterministic fail-closed safety gate evaluating 12 rules before granting authorization.",
    route_href: "/safety",
    status: "HEALTHY",
    metrics: { "Verdict": "AUTHORIZED", "Invariants": 12, "Violations": 0 },
  },
  {
    id: "hil",
    name: "7. Hardware HIL",
    category: "Execution",
    description: "ESP32 framed command transport protocol verified against virtual serial emulator endpoint.",
    route_href: "/hardware",
    status: "HEALTHY",
    metrics: { "Endpoint": "ESP32_VIRTUAL", "Transport": "FRAMED", "ACK RTT": "1.2ms" },
  },
];

export function PipelineOverview() {
  const [selectedStage, setSelectedStage] = useState<PipelineStage>(PIPELINE_STAGES[0]);

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs font-sans space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Canonical Neurotechnology Pipeline Architecture
          </h3>
          <p className="text-xs text-slate-500">
            Click any stage to view operational telemetry and open the dedicated engineering lab.
          </p>
        </div>
        <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Fail-Closed Invariant
        </span>
      </div>

      {/* Interactive Stage Flow Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isSelected = selectedStage.id === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelectedStage(stage)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-2xs"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-bold text-slate-400">Step {idx + 1}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xs font-bold text-slate-900 truncate">
                {stage.name.replace(/^\d+\.\s*/, "")}
              </div>
              <div className="text-2xs text-slate-500 truncate mt-0.5">
                {stage.category}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail Drawer */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">{selectedStage.name}</span>
            <span className="px-2 py-0.5 text-2xs font-bold bg-emerald-100 text-emerald-800 rounded-md">
              {selectedStage.status}
            </span>
          </div>
          <Link
            href={selectedStage.route_href}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Open Dedicated Lab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {selectedStage.description}
        </p>

        {/* Metrics Pill Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(selectedStage.metrics).map(([k, v]) => (
            <div
              key={k}
              className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between"
            >
              <span className="text-2xs text-slate-400 font-mono">{k}</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
