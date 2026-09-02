"use client";

import React, { useState } from "react";
import {
  Play,
  CheckCircle2,
  FlaskConical,
  Sparkles,
} from "lucide-react";


interface SimulationScenarioRunnerProps {
  onRunScenario: (scenarioId: string) => Promise<any>;
  isRunning?: boolean;
}

interface ScenarioMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  expectedOutcome: string;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: "SCENARIO_A_STABLE_HIGH_CONFIDENCE",
    title: "Scenario A: Stable High Confidence",
    category: "Confirmation",
    description: "Continuous consistent predictions (LEFT) exceeding enter threshold across 3 windows (750ms).",
    expectedOutcome: "Temporally Confirmed at Window 3",
  },
  {
    id: "SCENARIO_B_PREDICTION_FLICKER",
    title: "Scenario B: Prediction Flicker",
    category: "Continuity",
    description: "Oscillating predictions (LEFT -> RIGHT -> LEFT -> RIGHT).",
    expectedOutcome: "Confirmation Blocked / Reset to 1",
  },
  {
    id: "SCENARIO_C_POOR_SIGNAL_QUALITY",
    title: "Scenario C: Poor Signal Quality Rejection",
    category: "Gating",
    description: "High raw model confidence (98%) paired with severe electrode artifact (quality = 0.25 < floor 0.50).",
    expectedOutcome: "Rejected (LOW_SIGNAL / Ineligible)",
  },
  {
    id: "SCENARIO_D_STALE_DATA",
    title: "Scenario D: Stale Stream Timeout",
    category: "Freshness",
    description: "Electrophysiological packet delayed by 800ms exceeding max allowable latency (400ms).",
    expectedOutcome: "Gated (STALE / Accumulation Paused)",
  },
  {
    id: "SCENARIO_E_MODEL_VERSION_SWITCH",
    title: "Scenario E: Model Version Switch Isolation",
    category: "Provenance",
    description: "Live model update from v1 to v2 occurs mid-accumulation.",
    expectedOutcome: "Reset with MODEL_CHANGED Reason",
  },
  {
    id: "SCENARIO_F_SUBJECT_SWITCH",
    title: "Scenario F: Subject Boundary Reset",
    category: "Provenance",
    description: "Active subject profile changes from sub-001 to sub-002 mid-stream.",
    expectedOutcome: "Reset with SUBJECT_CHANGED Reason",
  },
  {
    id: "SCENARIO_G_HYSTERESIS_BOUNDARY",
    title: "Scenario G: Hysteresis Threshold Gating",
    category: "Hysteresis",
    description: "Predictions hover at 65% (above 60% exit floor, below 75% enter threshold).",
    expectedOutcome: "Suppressed from Idle (No false entrance)",
  },
  {
    id: "SCENARIO_H_COOLDOWN_SUPPRESSION",
    title: "Scenario H: Cooldown Re-Confirmation",
    category: "Debounce",
    description: "Window immediately following successful confirmation attempts duplicate trigger.",
    expectedOutcome: "Suppressed under Cooldown (1000ms)",
  },
];

export function SimulationScenarioRunner({
  onRunScenario,
  isRunning = false,
}: SimulationScenarioRunnerProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioOutput, setScenarioOutput] = useState<any | null>(null);
  const [localRunning, setLocalRunning] = useState(false);

  const handleExecute = async (scenario: ScenarioMeta) => {
    setActiveScenarioId(scenario.id);
    setLocalRunning(true);
    try {
      const res = await onRunScenario(scenario.id);
      setScenarioOutput(res);
    } catch (err) {
      console.error("Scenario execution error:", err);
    } finally {
      setLocalRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Deterministic Scenario Verification Lab</h3>
            <p className="text-xs text-slate-500">Rigorous validation scenarios (A through H) for temporal gating and confidence boundaries</p>
          </div>
        </div>
      </div>

      {/* Scenario Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SCENARIOS.map((sc) => {
          const isSelected = activeScenarioId === sc.id;
          return (
            <div
              key={sc.id}
              className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50/30 shadow-sm"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                    {sc.category}
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900">{sc.title}</h4>
                <p className="text-[11px] text-slate-600 leading-snug">{sc.description}</p>
                <div className="text-[11px] text-slate-500 pt-1">
                  <span className="font-medium text-slate-700">Expected:</span> {sc.expectedOutcome}
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => handleExecute(sc)}
                  disabled={localRunning || isRunning}
                  className={`w-full py-1.5 px-3 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm ${
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  } disabled:opacity-50`}
                >
                  <Play className={`w-3 h-3 ${isSelected && localRunning ? "animate-spin" : ""}`} />
                  {isSelected && localRunning ? "Running..." : "Execute Scenario"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution Results Viewer */}
      {scenarioOutput && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-900">
                Execution Output: {scenarioOutput.scenario_id}
              </span>
            </div>
            <span className="text-2xs font-mono text-slate-500">
              {new Date(scenarioOutput.executed_at).toLocaleTimeString()}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-2xs text-slate-500 border-b border-slate-200 uppercase bg-slate-50">
                <tr>
                  <th className="py-1.5 px-2">Step</th>
                  <th className="py-1.5 px-2">Prediction</th>
                  <th className="py-1.5 px-2">Confidence</th>
                  <th className="py-1.5 px-2">Temporal Status</th>
                  <th className="py-1.5 px-2">Confirmed</th>
                  <th className="py-1.5 px-2">Reason / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-2xs">
                {scenarioOutput.results?.map((r: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-slate-500 font-bold">#{r.step}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">{r.prediction || "—"}</td>
                    <td className="py-1.5 px-2 text-blue-700 font-semibold">
                      {r.confidence !== undefined ? `${(r.confidence * 100).toFixed(1)}%` : r.raw_score ? `Raw: ${(r.raw_score * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-teal-700 font-semibold">{r.temporal_status}</td>
                    <td className="py-1.5 px-2">
                      {r.confirmed ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> TRUE
                        </span>
                      ) : (
                        <span className="text-slate-400">FALSE</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-slate-600 truncate max-w-xs">{r.reason || "Compliant step"}</td>
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

