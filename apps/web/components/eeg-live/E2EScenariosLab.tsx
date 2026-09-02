"use client";

import React, { useState } from "react";
import { EegE2EResult } from "@neuromove/contracts";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Layers,
  ShieldCheck,
  Cpu,
} from "lucide-react";

interface E2EScenariosLabProps {
  scenarioResults: Record<string, EegE2EResult>;
  onRunScenario: (scenarioId: string) => void;
  onRunAllScenarios: () => void;
  isLoading?: boolean;
}

export const GOLDEN_SCENARIOS = [
  {
    id: "SCENARIO_A",
    name: "Synthetic Simulator Full E2E Pipeline",
    category: "End-to-End",
    description: "Simulated 8-ch EEG -> DSP -> Features -> Model -> Safety -> ESP32 HIL frame dispatch.",
  },
  {
    id: "SCENARIO_B",
    name: "Recorded Fixture Replay Full Pipeline",
    category: "End-to-End",
    description: "Compact SHA-256 fixture ingestion -> Monotonic clock -> Inference -> Safety check.",
  },
  {
    id: "SCENARIO_C",
    name: "Physical BioAmp Honest Availability Check",
    category: "Adapters & Replay",
    description: "Safe probing without hardware -> Honest unavailable status -> Zero fake actuation.",
  },
  {
    id: "SCENARIO_D",
    name: "Single-Channel QC Flatline Gating",
    category: "Faults & Safety",
    description: "Channel C3 flatline injection -> QC degradation flag -> Calibration gate blocked.",
  },
  {
    id: "SCENARIO_E",
    name: "Timestamp Discontinuity & Drift Recovery",
    category: "Faults & Safety",
    description: "Backward timestamp injection -> Clock normalizer discontinuity detection & recovery.",
  },
  {
    id: "SCENARIO_F",
    name: "Low-Confidence Ambiguous Intent Hold",
    category: "Faults & Safety",
    description: "Ambiguous sensorimotor ERD -> Phase 17 Safety HELD -> 0 HIL serial frames sent.",
  },
  {
    id: "SCENARIO_G",
    name: "Authorized Intent ESP32 HIL Transmission",
    category: "End-to-End",
    description: "Valid TURN_RIGHT intent -> Pre-flight auth validation -> Frame delivered & ACKed.",
  },
  {
    id: "SCENARIO_H",
    name: "Mid-Stream Sudden Disconnect Containment",
    category: "Adapters & Replay",
    description: "Sudden adapter disconnect -> Stream state ERROR -> Downstream pipeline halted.",
  },
  {
    id: "SCENARIO_I",
    name: "Reconnect Handshake & Fresh Session Boundary",
    category: "Adapters & Replay",
    description: "Device reconnect -> Session ID re-generation -> Sequence numbers reset to 0.",
  },
  {
    id: "SCENARIO_J",
    name: "Deterministic Fixture Byte-for-Byte Replay",
    category: "Adapters & Replay",
    description: "Repeatable offline replay -> Lineage hash comparison -> Identical decoding output.",
  },
];

export const E2EScenariosLab: React.FC<E2EScenariosLabProps> = ({
  scenarioResults,
  onRunScenario,
  onRunAllScenarios,
  isLoading = false,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  const filteredScenarios = GOLDEN_SCENARIOS.filter((sc) => {
    if (selectedFilter === "All") return true;
    return sc.category === selectedFilter;
  });

  const passedCount = Object.values(scenarioResults).filter((r) => r.passed).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            Phase 21 Golden E2E Verification Scenarios
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            10 automated verification scenarios • {passedCount} of {GOLDEN_SCENARIOS.length} verified green
          </p>
        </div>

        <button
          onClick={onRunAllScenarios}
          disabled={isLoading}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Play className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Run All 10 Scenarios
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs">
        {["All", "End-to-End", "Faults & Safety", "Adapters & Replay"].map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              selectedFilter === f
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Scenarios List */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {filteredScenarios.map((sc) => {
          const res = scenarioResults[sc.id];
          const hasRun = !!res;
          const passed = res?.passed ?? false;

          return (
            <div
              key={sc.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition-colors"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-700">{sc.id}</span>
                  <span className="text-sm font-semibold text-slate-900">{sc.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {sc.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{sc.description}</p>

                {res && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3 h-3 text-slate-400" />
                      Intent: <span className="font-mono text-slate-900">{res.predicted_intent}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Safety: <span className="font-mono">{res.safety_decision}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-blue-600" />
                      HIL: <span className="font-mono">{res.hil_status}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                {hasRun ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      passed
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {passed ? "PASSED" : "FAILED"}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    NOT RUN
                  </span>
                )}

                <button
                  onClick={() => onRunScenario(sc.id)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
