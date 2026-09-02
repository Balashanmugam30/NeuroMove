"use client";

import React, { useState } from "react";
import { FlaskConical, Play, CheckCircle2, XCircle, RefreshCw, Layers } from "lucide-react";
import { SafetyScenarioResult } from "@neuromove/contracts";

const SCENARIOS = [
  { id: "SCENARIO_A", name: "Scenario A — Fully Valid Intent", desc: "Active intent with healthy system, fresh timestamps, allowlisted class, no hold, no E-stop." },
  { id: "SCENARIO_B", name: "Scenario B — Unknown Health (Fail-Closed)", desc: "Critical service model_service reports UNKNOWN. System must fail closed to DENIED." },
  { id: "SCENARIO_C", name: "Scenario C — Stale Intent", desc: "Intent timestamp age exceeds policy limit (500ms). System rejects as stale." },
  { id: "SCENARIO_D", name: "Scenario D — Blocked Intent (REST)", desc: "Intent class is REST (configured in blocked_intents policy). Rejects as blocked." },
  { id: "SCENARIO_E", name: "Scenario E — Operator Hold", desc: "Manual operator hold is engaged. Candidate intent transitions to HELD." },
  { id: "SCENARIO_F", name: "Scenario F — Emergency Stop", desc: "Emergency stop actively asserted. Dominates all execution authorization." },
  { id: "SCENARIO_G", name: "Scenario G — Lockout", desc: "System lockout active due to consecutive failure threshold violations." },
  { id: "SCENARIO_H", name: "Scenario H — Rate Limit Exceeded", desc: "Command rate limit exceeded within sliding window." },
  { id: "SCENARIO_I", name: "Scenario I — Multiple Violations (Precedence)", desc: "E-Stop, blocked intent, and stale timestamp present simultaneously. E-stop dominates." },
  { id: "SCENARIO_J", name: "Scenario J — E-Stop Clear Procedure", desc: "Clearing E-stop moves machine to RESET_PENDING, never automatically authorizing." },
  { id: "SCENARIO_K", name: "Scenario K — Session Context Mismatch", desc: "Intent belongs to different subject than active session." },
  { id: "SCENARIO_L", name: "Scenario L — Rolled-Back Model", desc: "Active model has rolled_back flag set. Blocks authorization." },
  { id: "SCENARIO_M", name: "Scenario M — Idempotent Replay", desc: "Evaluating the same input in the same context produces identical verdicts." },
  { id: "SCENARIO_N", name: "Scenario N — Epoch 0 / Ancient Timestamp", desc: "Ancient timestamp intent fails closed." },
  { id: "SCENARIO_O", name: "Scenario O — Subsystem Recovery", desc: "Degraded service recovers to healthy, moving decision from DENIED to AUTHORIZED." },
];

interface SafetySimulationLabProps {
  onRunScenario: (scenarioId: string) => Promise<SafetyScenarioResult>;
}

export const SafetySimulationLab: React.FC<SafetySimulationLabProps> = ({ onRunScenario }) => {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SafetyScenarioResult>>({});
  const [runningAll, setRunningAll] = useState(false);

  const handleRun = async (id: string) => {
    try {
      setRunningId(id);
      const res = await onRunScenario(id);
      setResults((prev) => ({ ...prev, [id]: res }));
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    try {
      setRunningAll(true);
      for (const scen of SCENARIOS) {
        setRunningId(scen.id);
        const res = await onRunScenario(scen.id);
        setResults((prev) => ({ ...prev, [scen.id]: res }));
      }
    } finally {
      setRunningAll(false);
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Safety Simulation & Invariant Laboratory</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Execute 15 deterministic scenarios (A through O) to formally certify fail-closed invariants and precedence rules.
          </p>
        </div>

        <button
          onClick={handleRunAll}
          disabled={runningAll || runningId !== null}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center space-x-2 shadow-sm disabled:opacity-50"
        >
          {runningAll ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Layers className="w-4 h-4" />
          )}
          <span>{runningAll ? "Running Suite..." : "Run All 15 Scenarios"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((scen) => {
          const res = results[scen.id];
          const isRunning = runningId === scen.id;

          return (
            <div
              key={scen.id}
              className={`bg-white rounded-xl border p-4 shadow-sm transition-all flex flex-col justify-between ${
                res?.passed
                  ? "border-emerald-200 hover:border-emerald-300"
                  : res && !res.passed
                  ? "border-rose-300 bg-rose-50/20"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="font-mono text-xs font-bold text-slate-700">{scen.id}</span>
                  {res ? (
                    res.passed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <XCircle className="w-3 h-3" /> FAILED
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Ready</span>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-sm mt-2">{scen.name}</h4>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{scen.desc}</p>

                {res && (
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Decision:</span>
                      <span className="font-bold text-slate-800">{res.actual_decision}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">State:</span>
                      <span className="font-bold text-slate-800">{res.actual_state}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => handleRun(scen.id)}
                  disabled={isRunning || runningAll}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors flex items-center space-x-1 disabled:opacity-50"
                >
                  {isRunning ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{isRunning ? "Running..." : "Run Scenario"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
