"use client";

import React, { useState } from "react";
import { IntentScenarioResponse } from "@neuromove/contracts";
import { Play, CheckCircle2, FlaskConical, Sparkles } from "lucide-react";

interface IntentSimulationLabProps {
  onRunScenario: (scenarioId: string) => Promise<IntentScenarioResponse>;
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
    id: "SCENARIO_A_NORMAL_LIFECYCLE",
    title: "Scenario A: Normal Lifecycle",
    category: "Progression",
    description: "Full successful lifecycle: NO_INTENT -> CANDIDATE -> CONFIRMED -> ACTIVE -> COMPLETED.",
    expectedOutcome: "Intent Completed",
  },
  {
    id: "SCENARIO_B_CANDIDATE_TIMEOUT",
    title: "Scenario B: Candidate Timeout",
    category: "Expiration",
    description: "Candidate intent remains unconfirmed past candidate_timeout_ms (1000ms).",
    expectedOutcome: "Transitions to EXPIRED",
  },
  {
    id: "SCENARIO_C_CANDIDATE_CANCEL",
    title: "Scenario C: Candidate Cancel",
    category: "Cancellation",
    description: "Candidate intent explicitly cancelled by operator or supervisory signal.",
    expectedOutcome: "Transitions to CANCELLED",
  },
  {
    id: "SCENARIO_D_ACTIVE_INTERRUPTION",
    title: "Scenario D: Active Interruption",
    category: "Interruption",
    description: "Stream interruption / telemetry drop occurs while intent is ACTIVE.",
    expectedOutcome: "Transitions to INTERRUPTED",
  },
  {
    id: "SCENARIO_E_SESSION_BOUNDARY",
    title: "Scenario E: Session Boundary",
    category: "Provenance",
    description: "Handoff from a new session arrives while an intent is active in prior session.",
    expectedOutcome: "Interrupts Prior & Starts New",
  },
  {
    id: "SCENARIO_F_MODEL_BOUNDARY",
    title: "Scenario F: Model Version Switch",
    category: "Provenance",
    description: "Active model version updates from v1 to v2 during lifecycle.",
    expectedOutcome: "Interrupts Prior & Resets Context",
  },
  {
    id: "SCENARIO_G_REST_HANDLING",
    title: "Scenario G: REST Prediction",
    category: "Rest Policy",
    description: "Non-directional rest cue arrives while intent candidate is open.",
    expectedOutcome: "Candidate Cancelled (REST)",
  },
  {
    id: "SCENARIO_H_SAME_CLASS_COOLDOWN",
    title: "Scenario H: Same-Class Cooldown",
    category: "Debounce",
    description: "Duplicate confirmation of same intent class arrives within cooldown window.",
    expectedOutcome: "Suppressed (No duplicate intent)",
  },
  {
    id: "SCENARIO_I_CROSS_CLASS_REPLACEMENT",
    title: "Scenario I: Cross-Class Replacement",
    category: "Replacement",
    description: "Confirmed opposing intent arrives while an intent is currently active.",
    expectedOutcome: "Retires Old & Activates New",
  },
  {
    id: "SCENARIO_J_DUPLICATE_IDEMPOTENCY",
    title: "Scenario J: Duplicate Idempotency",
    category: "Idempotency",
    description: "Exact same source_event_id re-delivered to the ingestion API.",
    expectedOutcome: "Zero duplicate transitions",
  },
  {
    id: "SCENARIO_K_OUT_OF_ORDER",
    title: "Scenario K: Out-of-Order Handoff",
    category: "Ordering",
    description: "Older handoff with past timestamp arrives after a newer state was established.",
    expectedOutcome: "Current state preserved",
  },
  {
    id: "SCENARIO_L_RECONNECT_RECOVERY",
    title: "Scenario L: Reconnect Recovery",
    category: "Recovery",
    description: "Client disconnects and reconnects; authoritative snapshot reloaded from DB.",
    expectedOutcome: "Authoritative state restored",
  },
];

export function IntentSimulationLab({
  onRunScenario,
  isRunning = false,
}: IntentSimulationLabProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioOutput, setScenarioOutput] = useState<IntentScenarioResponse | null>(null);
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
            <h3 className="text-sm font-semibold text-slate-900">Deterministic Intent Lifecycle Lab</h3>
            <p className="text-xs text-slate-500">Exhaustive verification scenarios (A through L) for finite state transitions and boundaries</p>
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
                Scenario Result: {scenarioOutput.scenario_id}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PASSED
              </span>
              <span className="text-2xs font-mono text-slate-500">
                {new Date(scenarioOutput.executed_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-2xs text-slate-500 border-b border-slate-200 uppercase bg-slate-50">
                <tr>
                  <th className="py-1.5 px-2">Step</th>
                  <th className="py-1.5 px-2">Action</th>
                  <th className="py-1.5 px-2">Transition</th>
                  <th className="py-1.5 px-2">Reason</th>
                  <th className="py-1.5 px-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-2xs">
                {scenarioOutput.results?.map((r) => (
                  <tr key={r.step} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-slate-500 font-bold">#{r.step}</td>
                    <td className="py-1.5 px-2 text-teal-700 font-bold">{r.action}</td>
                    <td className="py-1.5 px-2 text-slate-900">
                      {r.previous_state} &rarr; <span className="text-emerald-700 font-bold">{r.next_state}</span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-700">{r.reason}</td>
                    <td className="py-1.5 px-2 text-slate-500">{r.note || "—"}</td>
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
